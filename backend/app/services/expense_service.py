"""Expense service + default category seeding."""
from app.core.exceptions import NotFoundError, ValidationAppError
from app.core.timezone import local_today

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
    cat_id = str(data.get("category_id") or "")
    try:
        cat = (sb.table("expense_categories").select("id").eq("id", cat_id)
               .eq("organization_id", org_id).maybe_single().execute())
    except Exception as e:
        raise ValidationAppError("Could not verify expense category") from e
    if not cat or not cat.data:
        raise NotFoundError("Expense category not found")
    payload = {"organization_id": org_id, "store_id": store_id,
               "created_by": user_id, **data}
    if "category_id" in payload:
        payload["category_id"] = str(payload["category_id"])
    if not payload.get("expense_date"):
        # DB default is current_date (UTC) — wrong before 08:00 Manila.
        payload["expense_date"] = local_today().isoformat()
    try:
        res = sb.table("expenses").insert(payload).execute()
    except Exception as e:
        raise ValidationAppError(
            f"Expense could not be recorded ({type(e).__name__})"
        ) from e
    rows = res.data or []
    if not rows:
        raise ValidationAppError("Expense could not be recorded")
    from app.services.user_service import enrich_actor_names
    enrich_actor_names(rows, "created_by")
    return rows[0]


def list_expenses(org_id: str, store_id: str, limit: int = 100) -> list[dict]:
    sb = _sb()
    rows = (sb.table("expenses").select("*").eq("organization_id", org_id)
            .eq("store_id", store_id).order("expense_date", desc=True)
            .limit(limit).execute().data or [])
    if not rows:
        return []
    cats = {c["id"]: c["name"] for c in list_categories(org_id)}
    from app.services.user_service import enrich_actor_names
    enrich_actor_names(rows, "created_by")
    return [{**r, "category_name": cats.get(r["category_id"])} for r in rows]
