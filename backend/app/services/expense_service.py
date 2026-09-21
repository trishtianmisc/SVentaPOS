"""Expense service + default category seeding."""
from app.core.exceptions import NotFoundError, ValidationAppError

DEFAULT_CATEGORIES = ["Rent", "Utilities", "Salaries", "Supplies", "Other"]


def _sb():
    from app.core.database import get_supabase_service

    return get_supabase_service()


def ensure_defaults(org_id: str) -> list[dict]:
    sb = _sb()
    existing = (sb.table("expense_categories").select("name")
                .eq("organization_id", org_id).execute().data or [])
    have = {r["name"].lower() for r in existing}
    missing = [{"organization_id": org_id, "name": n}
               for n in DEFAULT_CATEGORIES if n.lower() not in have]
    if missing:
        sb.table("expense_categories").insert(missing).execute()
    return list_categories(org_id)


def list_categories(org_id: str) -> list[dict]:
    sb = _sb()
    res = (sb.table("expense_categories").select("*")
           .eq("organization_id", org_id).order("name").execute())
    return res.data or []


def create_category(org_id: str, name: str) -> dict:
    sb = _sb()
    try:
        res = (sb.table("expense_categories")
               .insert({"organization_id": org_id, "name": name.strip()})
               .execute())
    except Exception:
        from app.core.exceptions import ConflictError
        raise ConflictError("Category already exists")
    rows = res.data or []
    if not rows:
        from app.core.exceptions import ConflictError
        raise ConflictError("Category already exists")
    return rows[0]


def create_expense(org_id: str, store_id: str, user_id: str, data: dict) -> dict:
    sb = _sb()
    cat = (sb.table("expense_categories").select("id").eq("id", data["category_id"])
           .eq("organization_id", org_id).maybe_single().execute())
    if not cat or not cat.data:
        raise NotFoundError("Expense category not found")
    payload = {"organization_id": org_id, "store_id": store_id,
               "created_by": user_id, **data}
    if not payload.get("expense_date"):
        payload.pop("expense_date", None)
    res = sb.table("expenses").insert(payload).execute()
    rows = res.data or []
    if not rows:
        raise ValidationAppError("Expense could not be recorded")
    return rows[0]


def list_expenses(org_id: str, store_id: str, limit: int = 100) -> list[dict]:
    sb = _sb()
    rows = (sb.table("expenses").select("*").eq("organization_id", org_id)
            .eq("store_id", store_id).order("expense_date", desc=True)
            .limit(limit).execute().data or [])
    if not rows:
        return []
    cats = {c["id"]: c["name"] for c in list_categories(org_id)}
    return [{**r, "category_name": cats.get(r["category_id"])} for r in rows]
