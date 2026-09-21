"""Inventory service via atomic adjust_stock RPC + read helpers."""
from app.core.exceptions import NotFoundError, ValidationAppError


def _sb():
    from app.core.database import get_supabase_service

    return get_supabase_service()


def list_inventory(store_id: str) -> list[dict]:
    sb = _sb()
    inv = sb.table("inventory").select("*").eq("store_id", store_id).execute()
    rows = inv.data or []
    if not rows:
        return []
    pids = [r["product_id"] for r in rows]
    prods = sb.table("products").select(
        "id,name,minimum_stock,reorder_level").in_("id", pids).execute()
    by_id = {p["id"]: p for p in (prods.data or [])}
    out = []
    for r in rows:
        p = by_id.get(r["product_id"], {})
        out.append({**r, "product_name": p.get("name"),
                    "minimum_stock": p.get("minimum_stock"),
                    "reorder_level": p.get("reorder_level")})
    return out


def get_stock(store_id: str, product_id: str) -> dict:
    sb = _sb()
    res = (
        sb.table("inventory").select("*")
        .eq("store_id", store_id).eq("product_id", product_id)
        .maybe_single().execute()
    )
    if not res or not res.data:
        return {"store_id": store_id, "product_id": product_id, "quantity": 0}
    return res.data


def low_stock(store_id: str) -> list[dict]:
    rows = list_inventory(store_id)
    return [r for r in rows
            if (r.get("reorder_level") or 0) > 0
            and (r.get("quantity") or 0) <= (r.get("reorder_level") or 0)]


def adjust(org_id: str, store_id: str, user_id: str, product_id: str,
           delta: float, movement_type: str, reason: str,
           unit_cost: float | None = None) -> dict:
    sb = _sb()
    try:
        res = sb.rpc("adjust_stock", {
            "p_org": org_id, "p_store": store_id, "p_product": product_id,
            "p_delta": delta, "p_type": movement_type, "p_reason": reason,
            "p_user": user_id, "p_unit_cost": unit_cost,
        }).execute()
    except Exception as e:
        raise ValidationAppError(_friendly(str(e)))
    data = res.data
    if isinstance(data, list):
        data = data[0] if data else {}
    if not data:
        raise NotFoundError("Product not found")
    return data


def movements(store_id: str, product_id: str | None = None, limit: int = 50) -> list[dict]:
    sb = _sb()
    q = (sb.table("inventory_movements").select("*")
         .eq("store_id", store_id).order("created_at", desc=True).limit(limit))
    if product_id:
        q = q.eq("product_id", product_id)
    res = q.execute()
    return res.data or []


def _friendly(msg: str) -> str:
    for code in ("ZERO_ADJUSTMENT", "INVALID_MOVEMENT_TYPE", "ADJUST_REASON_REQUIRED",
                 "PRODUCT_NOT_FOUND", "PRODUCT_NOT_TRACKED", "NEGATIVE_STOCK"):
        if code in msg:
            return code.replace("_", " ").title()
    return "Invalid adjustment"
