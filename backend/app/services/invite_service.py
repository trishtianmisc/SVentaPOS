"""Org invites: create/list/revoke/resend + accept (attach member).

Invitee does not need a pre-registered VentaPOS account. Email is sent via
Supabase Auth admin inviteUserByEmail (no custom SMTP). Copy-link is the
fallback when Auth email templates are disabled.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationAppError,
)

ASSIGNABLE_ROLES = ("owner", "manager", "cashier", "inventory")
INVITE_TTL_DAYS = 7


def _sb():
    from app.core.database import get_supabase_service
    return get_supabase_service()


def _auth_admin():
    return _sb().auth.admin


def app_base_url() -> str:
    from app.core.config import settings
    origins = settings.cors_origins or []
    return (origins[0] if origins else "http://localhost:5173").rstrip("/")


def accept_url(token: str) -> str:
    return f"{app_base_url()}/accept-invite?token={token}"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _expires_iso() -> str:
    return (_now() + timedelta(days=INVITE_TTL_DAYS)).isoformat()


def _row_safe(row: dict) -> dict:
    out = dict(row)
    out.pop("token", None)
    out["invite_url"] = accept_url(row["token"]) if row.get("token") else None
    return out


def list_invites(org_id: str, status: str | None = "pending") -> list[dict]:
    q = (_sb().table("user_invites").select("*")
         .eq("organization_id", org_id).order("created_at", desc=True))
    if status:
        q = q.eq("status", status)
    rows = q.limit(100).execute().data or []
    return [_row_safe(r) for r in rows]


def _find_pending(org_id: str, email: str) -> dict | None:
    res = (_sb().table("user_invites").select("*")
           .eq("organization_id", org_id)
           .eq("status", "pending")
           .eq("email", email)
           .maybe_single().execute())
    return res.data if res and res.data else None


def _new_token() -> str:
    return secrets.token_urlsafe(32)


def _send_invite_email(email: str, token: str, full_name: str | None = None) -> str | None:
    """Supabase Auth invite email. Best-effort — copy-link always works."""
    url = accept_url(token)
    try:
        kwargs: dict = {"email": email}
        if full_name:
            kwargs["data"] = {"full_name": full_name, "invite_token": token}
        else:
            kwargs["data"] = {"invite_token": token}
        _auth_admin().invite_user_by_email(**kwargs)
        return None
    except Exception as e:
        return str(e)[:200]


def create_invite(org_id: str, email: str, role: str,
                  store_id: str | None, actor_id: str,
                  full_name: str | None = None, phone: str | None = None,
                  password: str | None = None) -> dict:
    """Create account with password when given; else pending invite."""
    from app.api.v1.dependencies import invalidate_user_context  # noqa: F401
    from app.services import audit_service, user_service

    role = (role or "").strip().lower()
    if role not in ASSIGNABLE_ROLES:
        raise ValidationAppError("Role must be owner, manager, cashier, or staff")
    email = (email or "").strip()
    if not email or "@" not in email:
        raise ValidationAppError("Email is required")
    full_name = (full_name or "").strip() or None
    phone = (phone or "").strip() or None

    # Owner set an initial password → create the Auth user immediately.
    if password:
        try:
            return user_service.create_member_with_password(
                org_id, email, role, store_id, actor_id, password,
                full_name=full_name, phone=phone)
        except (ConflictError, NotFoundError, ForbiddenError, ValidationAppError):
            raise
        except Exception:
            # Auth admin unavailable → fall through to invite link.
            pass

    sb = _sb()

    # Already registered + free → attach immediately (Model A path).
    # add_member owns org-conflict checks and profile/store inserts.
    auth_user = user_service.find_auth_user_by_email(email)
    if auth_user:
        return user_service.add_member(
            org_id, email, role, store_id, actor_id,
            full_name=full_name, phone=phone)

    sid = user_service._resolve_store_id(org_id, store_id)

    pending = _find_pending(org_id, email)
    token = _new_token()
    if pending:
        (sb.table("user_invites").update({
            "role": role, "store_id": sid, "token": token,
            "full_name": full_name, "phone": phone,
            "expires_at": _expires_iso(), "invited_by": actor_id,
        }).eq("id", pending["id"]).execute())
        invite_id = pending["id"]
    else:
        try:
            res = sb.table("user_invites").insert({
                "organization_id": org_id, "store_id": sid,
                "email": email, "role": role, "token": token,
                "full_name": full_name, "phone": phone,
                "invited_by": actor_id, "expires_at": _expires_iso(),
                "status": "pending",
            }).execute()
        except Exception as e:
            msg = str(e).lower()
            if "duplicate" in msg or "unique" in msg:
                raise ConflictError("An invite for that email is already pending") from e
            raise ValidationAppError("Could not create invite, please retry") from e
        rows = res.data or []
        if not rows:
            raise ValidationAppError("Could not create invite, please retry")
        invite_id = rows[0]["id"]

    email_err = _send_invite_email(email, token, full_name=full_name)

    audit_service.record(
        org_id, "user.invite", "user_invite", str(invite_id),
        user_id=actor_id, store_id=sid,
        metadata={"email": email, "role": role,
                  "email_sent": email_err is None,
                  "email_error": email_err})

    created = (sb.table("user_invites").select("*")
               .eq("id", invite_id).maybe_single().execute())
    row = created.data if created and created.data else {
        "id": invite_id, "email": email, "role": role, "token": token,
        "status": "pending", "store_id": sid, "organization_id": org_id,
        "full_name": full_name, "phone": phone,
    }
    out = _row_safe({**row, "token": token})
    out["status"] = "invited"
    out["full_name"] = full_name or out.get("full_name")
    out["phone"] = phone or out.get("phone")
    out["last_login"] = None
    out["is_self"] = False
    out["id"] = str(invite_id)
    out["email_error"] = email_err
    out["roles"] = [{"store_id": sid, "role": role}] if sid else []
    return out


def revoke_invite(org_id: str, invite_id: str, actor_id: str) -> dict:
    from app.services import audit_service
    sb = _sb()
    res = (sb.table("user_invites").select("*")
           .eq("id", invite_id).eq("organization_id", org_id)
           .maybe_single().execute())
    row = res.data if res and res.data else None
    if not row:
        raise NotFoundError("Invite not found")
    if row["status"] != "pending":
        raise ConflictError(f"Invite is {row['status']}")
    (sb.table("user_invites").update({"status": "revoked"})
     .eq("id", invite_id).execute())
    audit_service.record(
        org_id, "user.invite_revoke", "user_invite", invite_id,
        user_id=actor_id, metadata={"email": row.get("email")})
    return {"id": invite_id, "status": "revoked"}


def resend_invite(org_id: str, invite_id: str, actor_id: str) -> dict:
    from app.services import audit_service
    sb = _sb()
    res = (sb.table("user_invites").select("*")
           .eq("id", invite_id).eq("organization_id", org_id)
           .maybe_single().execute())
    row = res.data if res and res.data else None
    if not row:
        raise NotFoundError("Invite not found")
    if row["status"] not in ("pending", "expired"):
        raise ConflictError(f"Invite is {row['status']}")
    token = _new_token()
    (sb.table("user_invites").update({
        "token": token, "status": "pending", "expires_at": _expires_iso(),
    }).eq("id", invite_id).execute())
    email_err = _send_invite_email(row["email"], token)
    audit_service.record(
        org_id, "user.invite_resend", "user_invite", invite_id,
        user_id=actor_id,
        metadata={"email": row.get("email"), "email_sent": email_err is None})
    out = _row_safe({**row, "token": token, "status": "pending"})
    out["email_error"] = email_err
    return out


def _load_valid_invite(token: str) -> dict:
    if not token or len(token) < 16:
        raise ValidationAppError("Invalid invite link")
    res = (_sb().table("user_invites").select("*")
           .eq("token", token).maybe_single().execute())
    row = res.data if res and res.data else None
    if not row:
        raise NotFoundError("Invite not found or already used")
    if row["status"] == "accepted":
        raise ConflictError("This invite was already accepted")
    if row["status"] == "revoked":
        raise ConflictError("This invite was revoked")
    exp = row.get("expires_at")
    if exp:
        try:
            expires = datetime.fromisoformat(str(exp).replace("Z", "+00:00"))
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            if expires < _now():
                ( _sb().table("user_invites").update({"status": "expired"})
                 .eq("id", row["id"]).execute())
                raise ConflictError("This invite has expired — ask for a new one")
        except ValueError:
            pass
    return row


def peek_invite(token: str) -> dict:
    row = _load_valid_invite(token)
    return {
        "email": row["email"],
        "role": row["role"],
        "organization_id": row["organization_id"],
        "store_id": row.get("store_id"),
        "expires_at": row.get("expires_at"),
    }


def accept_invite(token: str, user_id: str, user_email: str | None,
                  full_name: str | None = None) -> dict:
    from app.api.v1.dependencies import invalidate_user_context
    from app.services import audit_service, subscription_service, user_service

    row = _load_valid_invite(token)
    invite_email = (row.get("email") or "").strip().lower()
    actor_email = (user_email or "").strip().lower()
    if actor_email and actor_email != invite_email:
        raise ForbiddenError(
            f"This invite is for {invite_email} — sign in with that email")

    org_id = str(row["organization_id"])
    role = row["role"]
    sid = row.get("store_id")
    uid = str(user_id)
    sb = _sb()

    prof_res = (sb.table("profiles").select("id,full_name,organization_id")
                .eq("id", uid).maybe_single().execute())
    prof = prof_res.data if prof_res and prof_res.data else None
    if prof and prof.get("organization_id"):
        if str(prof["organization_id"]) == org_id:
            # Already linked (e.g. double-click) — mark invite accepted.
            (sb.table("user_invites").update({
                "status": "accepted", "accepted_at": _now().isoformat(),
                "accepted_by": uid,
            }).eq("id", row["id"]).execute())
            stores = user_service._org_stores(org_id)
            return {
                "organization_id": org_id,
                "store_id": (sid or (stores[0]["id"] if stores else None)),
                "role": role,
            }
        raise ConflictError("That account already belongs to another business")

    subscription_service.check_limit(org_id, "users")
    sid = user_service._resolve_store_id(org_id, sid)
    name = ((prof or {}).get("full_name") or full_name
            or invite_email.split("@")[0])
    phone = (prof or {}).get("phone") or row.get("phone")

    try:
        if prof:
            patch = {"organization_id": org_id, "full_name": name}
            if phone is not None:
                patch["phone"] = phone
            (sb.table("profiles").update(patch)
             .eq("id", uid).execute())
        else:
            sb.table("profiles").insert({
                "id": uid, "organization_id": org_id, "full_name": name,
                "phone": phone, "status": "active",
            }).execute()
        sb.table("store_users").insert({
            "store_id": sid, "user_id": uid, "role": role,
        }).execute()
        (sb.table("user_invites").update({
            "status": "accepted", "accepted_at": _now().isoformat(),
            "accepted_by": uid,
        }).eq("id", row["id"]).execute())
    except Exception as e:
        msg = str(e).lower()
        if "duplicate" in msg or "unique" in msg:
            raise ConflictError("Already a member of this business") from e
        raise ValidationAppError("Could not accept invite, please retry") from e

    invalidate_user_context(uid)
    audit_service.record(
        org_id, "user.accept_invite", "user", uid, user_id=uid,
        store_id=sid, metadata={"email": invite_email, "role": role,
                                "invite_id": row["id"]})
    return {
        "organization_id": org_id,
        "store_id": sid,
        "role": role,
        "full_name": name,
        "email": invite_email,
        "phone": phone,
    }
