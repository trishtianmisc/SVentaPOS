"""Organization bootstrap service.

Self-serve account+store creation: one call creates the organization,
settings row, profile link, first store, and owner membership.
One business per signup: users who already belong to an organization
are rejected (joining an existing org is a separate invite flow).
"""
import re

from app.core.exceptions import ConflictError, ValidationAppError


def _sb():
    from app.core.database import get_supabase_service

    return get_supabase_service()


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if not slug:
        raise ValidationAppError("Business name is required")
    return slug[:64]


def bootstrap(user_id: str, email: str | None, full_name: str | None,
              org_name: str, store_name: str,
              store_code: str = "MAIN") -> dict:
    sb = _sb()
    org_name = (org_name or "").strip()
    store_name = (store_name or "").strip()
    if not org_name or not store_name:
        raise ValidationAppError("Business and store names are required")

    existing = (sb.table("profiles").select("organization_id")
                .eq("id", user_id).maybe_single().execute())
    if existing and existing.data and existing.data.get("organization_id"):
        raise ConflictError("Account already belongs to an organization")

    slug = slugify(org_name)
    taken = (sb.table("organizations").select("id").eq("slug", slug)
             .maybe_single().execute())
    if taken and taken.data:
        raise ConflictError("Business name is taken, try another")

    org_id = store_id = None
    try:
        org = (sb.table("organizations")
               .insert({"name": org_name, "slug": slug}).execute().data or [None])[0]
        if not org:
            raise ValidationAppError("Organization could not be created")
        org_id = org["id"]
        sb.table("organization_settings").insert(
            {"organization_id": org_id}).execute()
        sb.table("profiles").upsert(
            {"id": user_id, "organization_id": org_id,
             "full_name": full_name or (email or "").split("@")[0]},
            on_conflict="id").execute()
        store = (sb.table("stores").insert({
            "organization_id": org_id, "name": store_name,
            "code": (store_code or "MAIN").strip().upper()}).execute()
            .data or [None])[0]
        if not store:
            raise ValidationAppError("Store could not be created")
        store_id = store["id"]
        sb.table("store_users").insert(
            {"store_id": store_id, "user_id": user_id,
             "role": "owner"}).execute()
    except (ConflictError, ValidationAppError):
        raise
    except Exception as e:
        # Best-effort rollback: org delete cascades to children.
        try:
            if org_id:
                sb.table("organizations").delete().eq("id", org_id).execute()
        except Exception:
            pass
        msg = str(e).lower()
        if "duplicate" in msg or "unique" in msg:
            raise ConflictError("Name already taken, try another")
        raise ValidationAppError("Onboarding failed, please retry")

    from app.services import audit_service
    audit_service.record(
        org_id, "organization.bootstrap", "organization", org_id,
        user_id=user_id, store_id=store_id,
        metadata={"org": org_name, "store": store_name})
    return {"organization": {"id": org_id, "name": org_name, "slug": slug,
                             "status": "active"},
            "store": store}
