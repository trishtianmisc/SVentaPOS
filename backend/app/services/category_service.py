"""Category service - tenant-scoped CRUD. Delete = deactivate (auditable)."""
import re

from app.core.exceptions import ConflictError, NotFoundError


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "item"


def _sb():
    from app.core.database import get_supabase_service

    return get_supabase_service()


def list_categories(org_id: str) -> list[dict]:
    sb = _sb()
    res = (
        sb.table("categories")
        .select("*")
        .eq("organization_id", org_id)
        .order("name")
        .execute()
    )
    return res.data or []


def create_category(org_id: str, name: str, slug: str | None = None) -> dict:
    sb = _sb()
    payload = {
        "organization_id": org_id,
        "name": name.strip(),
        "slug": (slug or slugify(name)).strip().lower(),
    }
    try:
        res = sb.table("categories").insert(payload).execute()
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise ConflictError("Category slug already exists")
        raise
    rows = res.data or []
    if not rows:
        raise ConflictError("Category slug already exists")
    return rows[0]


def update_category(org_id: str, category_id: str, patch: dict) -> dict:
    sb = _sb()
    clean = {k: v for k, v in patch.items() if v is not None and k in ("name", "active")}
    if not clean:
        return get_category(org_id, category_id)
    res = (
        sb.table("categories")
        .update(clean)
        .eq("id", category_id)
        .eq("organization_id", org_id)
        .execute()
    )
    rows = res.data or []
    if not rows:
        raise NotFoundError("Category not found")
    return rows[0]


def get_category(org_id: str, category_id: str) -> dict:
    sb = _sb()
    res = (
        sb.table("categories")
        .select("*")
        .eq("id", category_id)
        .eq("organization_id", org_id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise NotFoundError("Category not found")
    return res.data


def deactivate_category(org_id: str, category_id: str) -> dict:
    return update_category(org_id, category_id, {"active": False})
