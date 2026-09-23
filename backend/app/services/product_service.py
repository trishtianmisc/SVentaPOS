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
    # Normalize empty strings to null for unique-able / optional fields.
    for f in ("sku", "barcode", "brand", "image_path"):
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
        "vat_exempt", "image_path",
    )
    clean = {k: v for k, v in patch.items() if k in allowed and v is not None}
    if "sku" in clean and clean["sku"] == "":
        clean["sku"] = None
    if "barcode" in clean and clean["barcode"] == "":
        clean["barcode"] = None
    if "image_path" in clean and clean["image_path"] == "":
        clean["image_path"] = None
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


# Sell units (Phase 4 C1): alternates to the implicit base ('pc') unit. ----


def list_all_units(org_id: str) -> list[dict]:
    sb = _sb()
    pids = [p["id"] for p in
            (sb.table("products").select("id").eq("organization_id", org_id)
             .execute().data or [])]
    if not pids:
        return []
    res = (sb.table("product_units").select("*").in_("product_id", pids)
           .order("conversion_factor").execute())
    return res.data or []


def list_units(org_id: str, product_id: str) -> list[dict]:
    get_product(org_id, product_id)  # validates tenancy
    sb = _sb()
    res = (sb.table("product_units").select("*")
           .eq("product_id", product_id).order("conversion_factor")
           .execute())
    return res.data or []


def create_unit(org_id: str, product_id: str, data: dict) -> dict:
    get_product(org_id, product_id)  # validates tenancy
    name = (data.get("unit_name") or "").strip()
    if not name:
        from app.core.exceptions import ValidationAppError

        raise ValidationAppError("Unit name required")
    if name.lower() == "pc":
        from app.core.exceptions import ValidationAppError

        raise ValidationAppError("'pc' is the implicit base unit")
    sb = _sb()
    try:
        res = sb.table("product_units").insert({
            "product_id": product_id, "unit_name": name,
            "conversion_factor": data["conversion_factor"],
            "selling_price": data.get("selling_price"),
            "cost_price": data.get("cost_price"),
            "barcode": data.get("barcode") or None}).execute()
    except Exception as e:
        msg = str(e).lower()
        if "duplicate" in msg or "unique" in msg:
            raise ConflictError("Unit already exists for this product")
        raise
    rows = res.data or []
    if not rows:
        raise ConflictError("Unit could not be created")
    return rows[0]


def delete_unit(org_id: str, product_id: str, unit_id: str) -> None:
    get_product(org_id, product_id)  # validates tenancy
    sb = _sb()
    res = (sb.table("product_units").delete()
           .eq("id", unit_id).eq("product_id", product_id).execute())
    if not (res.data or []):
        raise NotFoundError("Unit not found")


def update_unit(org_id: str, product_id: str, unit_id: str, patch: dict) -> dict:
    get_product(org_id, product_id)  # validates tenancy
    allowed = (
        "unit_name", "conversion_factor", "selling_price",
        "cost_price", "barcode",
    )
    clean = {k: v for k, v in patch.items() if k in allowed}
    if "unit_name" in clean:
        name = (clean["unit_name"] or "").strip()
        if not name:
            from app.core.exceptions import ValidationAppError

            raise ValidationAppError("Unit name required")
        if name.lower() == "pc":
            from app.core.exceptions import ValidationAppError

            raise ValidationAppError("'pc' is the implicit base unit")
        clean["unit_name"] = name
    if "barcode" in clean and clean["barcode"] == "":
        clean["barcode"] = None
    if "conversion_factor" in clean:
        cf = clean["conversion_factor"]
        if cf is None or cf <= 0:
            from app.core.exceptions import ValidationAppError

            raise ValidationAppError("Conversion factor must be greater than 0")
    if "selling_price" in clean and clean["selling_price"] is not None:
        if clean["selling_price"] < 0:
            from app.core.exceptions import ValidationAppError

            raise ValidationAppError("Selling price cannot be negative")
    if not clean:
        raise NotFoundError("Unit not found")
    sb = _sb()
    try:
        res = (
            sb.table("product_units")
            .update(clean)
            .eq("id", unit_id)
            .eq("product_id", product_id)
            .execute()
        )
    except Exception as e:
        msg = str(e).lower()
        if "duplicate" in msg or "unique" in msg:
            raise ConflictError("Unit already exists for this product")
        raise
    rows = res.data or []
    if not rows:
        raise NotFoundError("Unit not found")
    return rows[0]
