"""Supplier service - tenant-scoped CRUD, deactivate instead of delete."""
from app.core.exceptions import NotFoundError, ValidationAppError


def _sb():
    from app.core.database import get_supabase_service

    return get_supabase_service()


def list_suppliers(org_id: str) -> list[dict]:
    sb = _sb()
    res = (sb.table("suppliers").select("*").eq("organization_id", org_id)
           .order("name").execute())
    return res.data or []


def get_supplier(org_id: str, supplier_id: str) -> dict:
    sb = _sb()
    res = (sb.table("suppliers").select("*").eq("id", supplier_id)
           .eq("organization_id", org_id).maybe_single().execute())
    if not res or not res.data:
        raise NotFoundError("Supplier not found")
    return res.data


def create_supplier(org_id: str, data: dict) -> dict:
    sb = _sb()
    res = sb.table("suppliers").insert(
        {"organization_id": org_id, **data}).execute()
    rows = res.data or []
    if not rows:
        raise ValidationAppError("Supplier could not be created")
    return rows[0]


def update_supplier(org_id: str, supplier_id: str, patch: dict) -> dict:
    sb = _sb()
    allowed = ("name", "contact_name", "phone", "address", "notes", "active")
    clean = {k: v for k, v in patch.items() if k in allowed and v is not None}
    if not clean:
        return get_supplier(org_id, supplier_id)
    res = (sb.table("suppliers").update(clean).eq("id", supplier_id)
           .eq("organization_id", org_id).execute())
    if not (res.data or []):
        raise NotFoundError("Supplier not found")
    return get_supplier(org_id, supplier_id)
