"""Demand forecast + restock suggestions (Phase 5).

Transparent arithmetic, honestly labeled: per-product daily sales velocity
over a trailing window -> days of cover from current on-hand stock ->
suggested reorder quantity to reach `reorder_level + cover_target` days.
Estimates only; every input is returned so the UI can show its work.
"""
import math
from datetime import date, timedelta


COVER_TARGET_DAYS = 14


def _sb():
    from app.core.database import get_supabase_service

    return get_supabase_service()


def forecast(org_id: str, store_id: str, window_days: int = 14) -> dict:
    if window_days < 1 or window_days > 90:
        from app.core.exceptions import ValidationAppError

        raise ValidationAppError("Window must be 1-90 days")
    sb = _sb()
    since = (date.today() - timedelta(days=window_days)).isoformat()

    sales_rows = (sb.table("sales").select("id,created_at")
                  .eq("organization_id", org_id).eq("store_id", store_id)
                  .eq("status", "COMPLETED").gte("created_at", since)
                  .limit(2000).execute().data or [])
    sold: dict[str, float] = {}
    if sales_rows:
        items = (sb.table("sale_items").select("product_id,quantity")
                 .in_("sale_id", [r["id"] for r in sales_rows])
                 .execute().data or [])
        for it in items:
            sold[it["product_id"]] = sold.get(it["product_id"], 0) + float(
                it["quantity"])

    inv = (sb.table("inventory").select("product_id,quantity")
           .eq("store_id", store_id).execute().data or [])
    on_hand = {r["product_id"]: float(r["quantity"]) for r in inv}

    prods = (sb.table("products")
             .select("id,name,cost_price,reorder_level,track_inventory")
             .eq("organization_id", org_id).execute().data or [])

    rows = []
    for p in prods:
        if p.get("track_inventory") is False:
            continue
        pid = p["id"]
        window_qty = round(sold.get(pid, 0), 2)
        velocity = window_qty / window_days
        qty = on_hand.get(pid, 0)
        cover = round(qty / velocity, 1) if velocity > 0 else None
        reorder = float(p.get("reorder_level") or 0)
        target = reorder + velocity * COVER_TARGET_DAYS
        suggested = max(0.0, target - qty)
        # Surface rows that sell, are low, or already need reordering.
        if window_qty <= 0 and qty > reorder and suggested <= 0:
            continue
        rows.append({
            "product_id": pid,
            "product_name": p.get("name"),
            "cost_price": float(p.get("cost_price") or 0),
            "reorder_level": reorder,
            "on_hand": round(qty, 2),
            "sold_in_window": window_qty,
            "daily_velocity": round(velocity, 3),
            "days_cover": cover,
            "suggested_qty": math.ceil(suggested) if suggested > 0 else 0,
        })
    rows.sort(key=lambda r: (r["days_cover"] is None, r["days_cover"] or 0))
    return {"as_of": date.today().isoformat(),
            "window_days": window_days,
            "cover_target_days": COVER_TARGET_DAYS,
            "estimate": True,
            "rows": rows}
