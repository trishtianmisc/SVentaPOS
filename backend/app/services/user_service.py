"""Org user management: attach pre-registered accounts, change role, remove.

Model A: no email service — the owner types the email of someone who already
registered once. We resolve that auth user with the service-role admin API,
then link their profile to this organization and grant a store role.
"""
from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationAppError,
)

ASSIGNABLE_ROLES = ("owner", "manager", "cashier", "inventory")
_ROLE_RANK = {"owner": 3, "manager": 2, "cashier": 1, "inventory": 0}


def _sb():
    from app.core.database import get_supabase_service

    return get_supabase_service()


def _primary_role(roles: list[str]) -> str:
    return max(roles, key=lambda r: _ROLE_RANK.get(r, -1), default="")


def display_names(user_ids) -> dict[str, str]:
    """Batch id -> display name (profiles.full_name, else email local-part)."""
    ids = {str(i) for i in user_ids if i}
    if not ids:
        return {}
    try:
        rows = (_sb().table("profiles").select("id,full_name")
                .in_("id", sorted(ids)).execute().data or [])
    except Exception:
        rows = []
    out: dict[str, str] = {}
    for r in rows:
        rid = str(r["id"])
        out[rid] = (r.get("full_name") or "").strip() or rid[:8]
    missing = ids - set(out)
    if missing:
        emails = _auth_emails(missing)
        for uid in missing:
            email = emails.get(uid)
            out[uid] = (email or uid[:8]).split("@")[0] if email else uid[:8]
    return out


def enrich_actor_names(rows: list[dict], *fields: str) -> list[dict]:
    """Attach `<field>_name` for each actor id field present on the rows."""
    if not rows:
        return rows
    ids: set[str] = set()
    for row in rows:
        for f in fields:
            if row.get(f):
                ids.add(str(row[f]))
    names = display_names(ids)
    for row in rows:
        for f in fields:
            key = f"{f}_name"
            if row.get(f):
                row[key] = names.get(str(row[f]))
            else:
                row.setdefault(key, None)
    return rows


def _auth_admin():
    return _sb().auth.admin


def find_auth_user_by_email(email: str) -> dict | None:
    """Resolve a Supabase auth user by email (service-role admin API)."""
    target = (email or "").strip().lower()
    if not target:
        return None
    page = 1
    try:
        while page <= 20:
            users = _auth_admin().list_users(page=page, per_page=100) or []
            for u in users:
                row = u.model_dump(mode="json") if hasattr(u, "model_dump") else (
                    u if isinstance(u, dict) else vars(u)
                )
                if (row.get("email") or "").lower() == target:
                    return row
            if len(users) < 100:
                break
            page += 1
    except Exception as e:
        raise ValidationAppError(f"Could not look up account by email ({e})") from e
    return None


def _auth_emails(user_ids: set[str]) -> dict[str, str]:
    """Best-effort id -> email map for org members."""
    out: dict[str, str] = {}
    if not user_ids:
        return out
    page = 1
    try:
        while page <= 20:
            users = _auth_admin().list_users(page=page, per_page=100) or []
            for u in users:
                row = u.model_dump(mode="json") if hasattr(u, "model_dump") else (
                    u if isinstance(u, dict) else vars(u)
                )
                uid = str(row.get("id") or "")
                if uid in user_ids and row.get("email"):
                    out[uid] = row["email"]
            if len(users) < 100:
                break
            page += 1
    except Exception:
        return out
    return out


def _auth_profiles(user_ids: set[str]) -> dict[str, dict]:
    """Best-effort id -> {email, last_sign_in_at} from Supabase Auth admin."""
    out: dict[str, dict] = {}
    if not user_ids:
        return out
    page = 1
    try:
        while page <= 20:
            users = _auth_admin().list_users(page=page, per_page=100) or []
            for u in users:
                row = u.model_dump(mode="json") if hasattr(u, "model_dump") else (
                    u if isinstance(u, dict) else vars(u)
                )
                uid = str(row.get("id") or "")
                if uid in user_ids:
                    out[uid] = {
                        "email": row.get("email"),
                        "last_sign_in_at": row.get("last_sign_in_at"),
                    }
            if len(users) < 100:
                break
            page += 1
    except Exception:
        return out
    return out


def _org_stores(org_id: str) -> list[dict]:
    res = (_sb().table("stores")
           .select("id,name,code,address,status,created_at")
           .eq("organization_id", org_id).order("created_at").execute())
    return res.data or []


def branch_stores(org_id: str) -> list[dict]:
    """All org branches for Owner Hub / Add Team Member (first = HQ)."""
    stores = _org_stores(org_id)
    return [
        {
            "id": s["id"],
            "name": s.get("name") or "",
            "code": s.get("code"),
            "address": s.get("address"),
            "status": s.get("status") or "active",
            "is_hq": i == 0,
        }
        for i, s in enumerate(stores)
    ]


def _resolve_store_id(org_id: str, store_id: str | None) -> str:
    stores = _org_stores(org_id)
    if not stores:
        raise ValidationAppError("No store yet — create a store first")
    if store_id:
        sid = str(store_id)
        if sid not in {s["id"] for s in stores}:
            raise ForbiddenError("Store not in this organization")
        return sid
    return stores[0]["id"]


def list_members(org_id: str, acting_user_id: str) -> list[dict]:
    sb = _sb()
    profiles = (sb.table("profiles")
                .select("id,full_name,phone,status,organization_id,created_at")
                .eq("organization_id", org_id).order("created_at").execute().data or [])
    if not profiles:
        return []
    pids = [p["id"] for p in profiles]
    stores = _org_stores(org_id)
    store_ids = [s["id"] for s in stores]
    store_names = {s["id"]: s.get("name") for s in stores}
    memberships: list[dict] = []
    if store_ids:
        memberships = (sb.table("store_users")
                       .select("user_id,store_id,role")
                       .in_("store_id", store_ids)
                       .in_("user_id", pids).execute().data or [])
    by_user: dict[str, list[dict]] = {}
    for m in memberships:
        by_user.setdefault(m["user_id"], []).append(m)
    auth_meta = _auth_profiles(set(pids))
    out = []
    for p in profiles:
        rows = by_user.get(p["id"], [])
        roles = [r["role"] for r in rows]
        role = _primary_role(roles)
        if not role:
            continue
        meta = auth_meta.get(p["id"]) or {}
        out.append({
            "id": p["id"],
            "full_name": p.get("full_name"),
            "email": meta.get("email"),
            "phone": p.get("phone"),
            "status": p.get("status") or "active",
            "role": role,
            "roles": [
                {"store_id": m["store_id"],
                 "store_name": store_names.get(m["store_id"]),
                 "role": m["role"]}
                for m in rows
            ],
            "is_self": str(p["id"]) == str(acting_user_id),
            "last_login": meta.get("last_sign_in_at"),
        })
    return out


def count_owners(org_id: str, exclude_user_id: str | None = None) -> int:
    members = list_members(org_id, acting_user_id="")
    n = 0
    for m in members:
        if exclude_user_id and str(m["id"]) == str(exclude_user_id):
            continue
        if "owner" in {r["role"] for r in m["roles"]} or m["role"] == "owner":
            n += 1
    return n


def add_member(org_id: str, email: str, role: str,
               store_id: str | None, acting_user_id: str,
               full_name: str | None = None, phone: str | None = None) -> dict:
    from app.api.v1.dependencies import invalidate_user_context
    from app.services import audit_service, subscription_service

    role = (role or "").strip().lower()
    if role not in ASSIGNABLE_ROLES:
        raise ValidationAppError("Role must be owner, manager, cashier, or staff")
    email = (email or "").strip()
    if not email:
        raise ValidationAppError("Email is required")
    phone = (phone or "").strip() or None
    full_name = (full_name or "").strip() or None

    sb = _sb()
    auth_user = find_auth_user_by_email(email)
    if not auth_user:
        raise NotFoundError(
            "No VentaPOS account with that email — ask them to register first, then try again")
    uid = str(auth_user["id"])

    profile = (sb.table("profiles").select("id,full_name,phone,organization_id,status")
               .eq("id", uid).maybe_single().execute())
    prof = profile.data if profile and profile.data else None

    if prof and prof.get("organization_id"):
        if str(prof["organization_id"]) == str(org_id):
            raise ConflictError("Already a member of this business")
        raise ConflictError("That account already belongs to another business")

    subscription_service.check_limit(org_id, "users")
    sid = _resolve_store_id(org_id, store_id)

    meta = auth_user.get("user_metadata") or {}
    name = full_name or (prof or {}).get("full_name") or meta.get("full_name") \
        or email.split("@")[0]
    next_phone = phone or (prof or {}).get("phone") or meta.get("phone")

    try:
        if prof:
            patch = {"organization_id": org_id, "full_name": name}
            if next_phone is not None:
                patch["phone"] = next_phone
            sb.table("profiles").update(patch).eq("id", uid).execute()
        else:
            sb.table("profiles").insert({
                "id": uid, "organization_id": org_id, "full_name": name,
                "phone": next_phone, "status": "active",
            }).execute()
        sb.table("store_users").insert({
            "store_id": sid, "user_id": uid, "role": role,
        }).execute()
    except Exception as e:
        msg = str(e).lower()
        if "duplicate" in msg or "unique" in msg:
            raise ConflictError("Already a member of this business") from e
        raise ValidationAppError("Could not add user, please retry") from e

    invalidate_user_context(uid)
    audit_service.record(
        org_id, "user.add", "user", uid, user_id=acting_user_id,
        store_id=sid, metadata={"email": email, "role": role})
    return {
        "id": uid, "full_name": name, "email": email, "phone": next_phone,
        "status": "active", "role": role,
        "roles": [{"store_id": sid, "role": role}],
        "is_self": str(uid) == str(acting_user_id),
        "last_login": auth_user.get("last_sign_in_at"),
    }


def create_member_with_password(
    org_id: str, email: str, role: str, store_id: str | None,
    acting_user_id: str, password: str,
    full_name: str | None = None, phone: str | None = None,
) -> dict:
    """Owner sets credentials → Supabase Auth admin creates the account.

    Returns an active member row (no invite). Falls back are handled by
    the caller (invite_service) if Auth admin create fails.
    """
    from app.api.v1.dependencies import invalidate_user_context
    from app.services import audit_service, subscription_service

    role = (role or "").strip().lower()
    if role not in ASSIGNABLE_ROLES:
        raise ValidationAppError("Role must be owner, manager, cashier, or staff")
    email = (email or "").strip()
    if not email or "@" not in email:
        raise ValidationAppError("Email is required")
    if not password or len(password) < 6:
        raise ValidationAppError("Password must be at least 6 characters")
    name = (full_name or "").strip()
    if not name:
        raise ValidationAppError("Full name is required")
    phone = (phone or "").strip() or None

    sb = _sb()
    existing = find_auth_user_by_email(email)
    if existing:
        # Already registered → attach path owns conflict checks.
        return add_member(org_id, email, role, store_id, acting_user_id,
                          full_name=name, phone=phone)

    subscription_service.check_limit(org_id, "users")
    sid = _resolve_store_id(org_id, store_id)

    user_data: dict = {"full_name": name}
    if phone:
        user_data["phone"] = phone
    try:
        created = _auth_admin().create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_data": user_data,
        })
    except Exception as e:
        # Let invite_service fall back to an invite link on Auth failures.
        raise RuntimeError(f"AUTH_CREATE_FAILED: {e}") from e

    row = created.user if hasattr(created, "user") and created.user else created
    raw = row.model_dump(mode="json") if hasattr(row, "model_dump") else (
        row if isinstance(row, dict) else vars(row))
    uid = str(raw.get("id") or "")
    if not uid:
        raise ValidationAppError("Could not create account, please retry")

    try:
        sb.table("profiles").insert({
            "id": uid, "organization_id": org_id, "full_name": name,
            "phone": phone, "status": "active",
        }).execute()
        sb.table("store_users").insert({
            "store_id": sid, "user_id": uid, "role": role,
        }).execute()
    except Exception as e:
        # Roll back the auth user so a retry can succeed cleanly.
        try:
            _auth_admin().delete_user(uid)
        except Exception:
            pass
        msg = str(e).lower()
        if "duplicate" in msg or "unique" in msg:
            raise ConflictError("Already a member of this business") from e
        raise ValidationAppError("Could not add user, please retry") from e

    invalidate_user_context(uid)
    audit_service.record(
        org_id, "user.create", "user", uid, user_id=acting_user_id,
        store_id=sid, metadata={"email": email, "role": role})
    return {
        "id": uid, "full_name": name, "email": email, "phone": phone,
        "status": "active", "role": role,
        "roles": [{"store_id": sid, "role": role}],
        "is_self": str(uid) == str(acting_user_id),
        "last_login": None,
    }


def change_role(org_id: str, user_id: str, role: str, acting_user_id: str) -> dict:
    from app.api.v1.dependencies import invalidate_user_context
    from app.services import audit_service

    role = (role or "").strip().lower()
    if role not in ASSIGNABLE_ROLES:
        raise ValidationAppError("Role must be owner, manager, cashier, or staff")
    uid = str(user_id)
    sb = _sb()

    profile = (sb.table("profiles").select("id,organization_id,full_name")
               .eq("id", uid).maybe_single().execute())
    prof = profile.data if profile and profile.data else None
    if not prof or str(prof.get("organization_id") or "") != str(org_id):
        raise NotFoundError("User not found in this business")

    stores = _org_stores(org_id)
    store_ids = [s["id"] for s in stores]
    if not store_ids:
        raise ValidationAppError("No store yet — create a store first")
    memberships = (sb.table("store_users").select("user_id,store_id,role")
                   .in_("store_id", store_ids).eq("user_id", uid).execute().data or [])
    if not memberships:
        raise NotFoundError("User has no store membership")

    current_roles = {m["role"] for m in memberships}
    if "owner" in current_roles and role != "owner":
        if count_owners(org_id, exclude_user_id=uid) < 1:
            raise ConflictError("Cannot demote the last owner")

    try:
        (sb.table("store_users").update({"role": role})
         .eq("user_id", uid).in_("store_id", store_ids).execute())
    except Exception as e:
        raise ValidationAppError("Could not change role, please retry") from e

    invalidate_user_context(uid)
    audit_service.record(
        org_id, "user.role", "user", uid, user_id=acting_user_id,
        metadata={"role": role, "previous": sorted(current_roles)})
    return {
        "id": uid, "full_name": prof.get("full_name"),
        "email": None, "status": "active", "role": role,
        "roles": [{"store_id": m["store_id"], "role": role} for m in memberships],
        "is_self": uid == str(acting_user_id),
        "last_login": None,
    }


def remove_member(org_id: str, user_id: str, acting_user_id: str) -> None:
    from app.api.v1.dependencies import invalidate_user_context
    from app.services import audit_service

    uid = str(user_id)
    if uid == str(acting_user_id):
        raise ValidationAppError("You cannot remove your own account here")

    sb = _sb()
    profile = (sb.table("profiles").select("id,organization_id,full_name")
               .eq("id", uid).maybe_single().execute())
    prof = profile.data if profile and profile.data else None
    if not prof or str(prof.get("organization_id") or "") != str(org_id):
        raise NotFoundError("User not found in this business")

    stores = _org_stores(org_id)
    store_ids = [s["id"] for s in stores]
    memberships = []
    if store_ids:
        memberships = (sb.table("store_users").select("user_id,store_id,role")
                       .in_("store_id", store_ids).eq("user_id", uid)
                       .execute().data or [])
    current_roles = {m["role"] for m in memberships}
    if "owner" in current_roles and count_owners(org_id, exclude_user_id=uid) < 1:
        raise ConflictError("Cannot remove the last owner")

    try:
        if store_ids:
            (sb.table("store_users").delete()
             .eq("user_id", uid).in_("store_id", store_ids).execute())
        sb.table("profiles").update({"organization_id": None}).eq("id", uid).execute()
    except Exception as e:
        raise ValidationAppError("Could not remove user, please retry") from e

    invalidate_user_context(uid)
    audit_service.record(
        org_id, "user.remove", "user", uid, user_id=acting_user_id,
        metadata={"previous": sorted(current_roles),
                  "name": prof.get("full_name")})
