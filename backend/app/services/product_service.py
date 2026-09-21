"""Product service - tenant-scoped CRUD. Delete = deactivate, never hard-delete."""
from app.core.exceptions import ConflictError, NotFoundError


def _sb():
    from app.core.database import get_supabase_service

    return get_supabase_service()


def list_products(org_id: str, search: str | None = None, active_only: bool = True) -> list[dict]:
    sb = _sb()
    q = sb.table("products").select("*").eq("organization_id", org_id)
    if active_only:
        q = q.eq("active", True)
    if search:
        q = q.ilike("name", f"%{search}%")
    res = q.order("name").limit(200).execute()
    return res.data or []


def get_product(org_id: str, product_id: str) -> dict:
    sb = _sb()
    res = (
        sb.table("products")
        .select("*")
        .eq("id", product_id)
        .eq("organization_id", org_id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise NotFoundError("Product not found")
    return res.data


def create_product(org_id: str, data: dict) -> dict:
    sb = _sb()
    payload = {"organization_id": org_id, **data}
    # Normalize empty strings to null for unique-able fields.
    for f in ("sku", "barcode"):
        if payload.get(f) == "":
            payload[f] = None
    try:
        res = sb.table("products").insert(payload).execute()
    except Exception as e:
        msg = str(e).lower()
        if "duplicate" in msg or "unique" in msg:
            raise ConflictError("SKU already exists")
        raise
    rows = res.data or []
    if not rows:
        raise ConflictError("Product could not be created")
    return rows[0]


def update_product(org_id: str, product_id: str, patch: dict) -> dict:
    sb = _sb()
    allowed = (
        "category_id", "name", "sku", "barcode", "brand", "cost_price",
        "retail_price", "wholesale_price", "wholesale_min_qty",
        "minimum_stock", "reorder_level", "track_inventory", "active",
    )
    clean = {k: v for k, v in patch.items() if k in allowed and v is not None}
    if "sku" in clean and clean["sku"] == "":
        clean["sku"] = None
    if "barcode" in clean and clean["barcode"] == "":
        clean["barcode"] = None
    if not clean:
        return get_product(org_id, product_id)
    try:
        res = (
            sb.table("products")
            .update(clean)
            .eq("id", product_id)
            .eq("organization_id", org_id)
            .execute()
        )
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise ConflictError("SKU already exists")
        raise
    rows = res.data or []
    if not rows:
        raise NotFoundError("Product not found")
    return rows[0]


def deactivate_product(org_id: str, product_id: str) -> dict:
    return update_product(org_id, product_id, {"active": False})
