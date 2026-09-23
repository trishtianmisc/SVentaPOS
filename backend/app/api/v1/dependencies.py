"""AuthZ dependencies: current org/store, role/permission checks.

Pattern (docs/05-auth-and-permissions.md):
  get_current_user -> get_current_organization -> get_current_store -> require_role

- Never trust org/store id from client alone; validate membership server-side.
- Never trust frontend role claims.
- RLS is defense in depth; this layer is mandatory.
"""
from dataclasses import dataclass, field
from uuid import UUID
import threading
import time

from fastapi import Depends, Header

from app.core.config import settings
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_bearer_token


@dataclass
class CurrentUser:
    id: UUID
    email: str | None = None
    organization_id: UUID | None = None
    full_name: str | None = None
    stores: list[dict] = field(default_factory=list)


# Resolved user context cache. Keyed by exact Supabase `sub` so one user's
# context can never be returned for another user. Short TTL (see
# user_context_ttl_seconds): profile/org/role data changes rarely, and every
# request still verifies the JWT itself — only the DB lookups are cached.
# Mutable business data (products, inventory, sales) is never cached here.
_user_context_cache: dict[str, tuple] = {}
_user_context_lock = threading.Lock()


def invalidate_user_context(user_id: str) -> None:
    """Drop one user's cached context. Call after role/store-membership
    changes so the next request re-reads from the database."""
    with _user_context_lock:
        _user_context_cache.pop(str(user_id), None)


def _fetch_profile_and_stores(user_id: str) -> tuple[dict | None, list[dict]]:
    """Single postgREST round trip: profile row with embedded memberships."""
    from app.core.database import get_supabase_service

    sb = get_supabase_service()
    res = (
        sb.table("profiles")
        .select("*,store_users(store_id,role)")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    row = res.data if res else None
    if not row:
        return None, []
    stores = row.pop("store_users", []) or []
    return row, stores


def _lookup_profile_and_stores(user_id: str) -> tuple[dict | None, list[dict]]:
    """Best-effort Supabase lookup. Returns (profile, store_users) or (None, [])."""
    key = str(user_id)
    now = time.monotonic()
    with _user_context_lock:
        hit = _user_context_cache.get(key)
        if hit and now - hit[2] < settings.user_context_ttl_seconds:
            return hit[0], hit[1]
    try:
        profile, stores = _fetch_profile_and_stores(key)
    except Exception:
        return None, []
    with _user_context_lock:
        _user_context_cache[key] = (profile, stores, time.monotonic())
    return profile, stores


async def get_current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    claims = decode_bearer_token(authorization)
    user_id = claims.get("sub")
    email = claims.get("email")
    profile, stores = _lookup_profile_and_stores(user_id)
    org_id = None
    if profile and profile.get("organization_id"):
        org_id = profile["organization_id"]
    try:
        return CurrentUser(
            id=UUID(user_id),
            email=email,
            organization_id=UUID(org_id) if org_id else None,
            full_name=(profile or {}).get("full_name"),
            stores=stores,
        )
    except ValueError:
        raise UnauthorizedError("Invalid user id")


async def get_current_organization(
    user: CurrentUser = Depends(get_current_user),
    x_organization_id: str | None = Header(default=None),
) -> UUID:
    """Resolve org from profile; if header supplied, it must match membership."""
    if x_organization_id:
        try:
            requested = UUID(x_organization_id)
        except ValueError:
            raise ForbiddenError("Invalid organization")
        if user.organization_id and requested != user.organization_id:
            raise ForbiddenError("Organization access denied")
        # When profile lookup unavailable (no DB in CI), trust is NOT granted:
        # require configured service key for cross-check in non-dev.
        if not settings.is_dev and not user.organization_id:
            raise ForbiddenError("Organization access denied")
        return requested
    if not user.organization_id:
        raise ForbiddenError("No organization context")
    return user.organization_id


async def get_current_store(
    user: CurrentUser = Depends(get_current_user),
    x_store_id: str | None = Header(default=None),
) -> dict | None:
    """Resolve store from X-Store-Id header, validated against membership."""
    if not x_store_id:
        return None
    try:
        sid = str(UUID(x_store_id))
    except ValueError:
        raise ForbiddenError("Invalid store")
    for s in user.stores:
        if str(s.get("store_id")) == sid:
            return s
    # Dev without DB: allow header through but flag; prod denies.
    if settings.is_dev and not user.stores:
        return {"store_id": sid, "role": "owner"}
    raise ForbiddenError("Store access denied")


def require_role(*allowed: str):
    """Usage: Depends(require_role('owner','manager'))."""
    allowed_set = {a.lower() for a in allowed}

    async def checker(store: dict | None = Depends(get_current_store)) -> dict:
        if not store:
            raise ForbiddenError("Store context required")
        if str(store.get("role", "")).lower() not in allowed_set:
            raise ForbiddenError("Insufficient role")
        return store

    return checker


def require_org_role(*allowed: str):
    """Org-scoped role check for org-level resources (catalog).

    Passes if the user holds an allowed role in ANY store of their
    organization. Single-store MVP friendly; cashiers stay blocked.
    """
    allowed_set = {a.lower() for a in allowed}

    async def checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        roles = {str(s.get("role", "")).lower() for s in user.stores}
        if not roles:
            raise ForbiddenError("Store context required")
        if roles.isdisjoint(allowed_set):
            raise ForbiddenError("Insufficient role")
        return user

    return checker


def require_feature(*features: str):
    """Org role-matrix gate. Owner always passes. Non-owner needs at least
    one of `features` enabled for any membership role (multi = OR).

    Stack with require_role / require_org_role — matrix only further
    restricts; it never expands fixed role floors."""
    allowed = tuple(f.lower() for f in features)

    async def checker(
        user: CurrentUser = Depends(get_current_user),
        org_id = Depends(get_current_organization),
        store: dict | None = Depends(get_current_store),
    ) -> CurrentUser:
        from app.services import permission_service

        roles: set[str] = set()
        if store and store.get("role"):
            roles.add(str(store["role"]).lower())
        for s in user.stores or []:
            if s.get("role"):
                roles.add(str(s["role"]).lower())
        if "owner" in roles:
            return user
        if not roles:
            raise ForbiddenError("Insufficient role")
        matrix = permission_service.get_matrix(str(org_id))
        if any(
            permission_service.can(role, feat, matrix)
            for role in roles
            for feat in allowed
        ):
            return user
        raise ForbiddenError("Feature not permitted")

    return checker


async def require_platform_admin(
    user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """SaaS operator gate. Allowlisted emails in PLATFORM_ADMIN_EMAILS.
    Tenant-scoped actions taken through this gate must be audit-logged."""
    if not settings.platform_admins:
        raise ForbiddenError("Platform administration is not configured")
    if (user.email or "").lower() not in settings.platform_admins:
        raise ForbiddenError("Platform administration only")
    return user
