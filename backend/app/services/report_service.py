"""Read-only report aggregations. Tax = 0 in Phase 2; profit uses
sale-item cost snapshots (exact), inventory value uses latest cost_price."""
from datetime import date


def _sb():
    from app.core.database import get_supabase_service

    return get_supabase_service()


def _in_range(day: str, start: str | None, end: str | None) -> bool:
    if start and day < start:
        return False
    if end and day > end:
        return False
    return True


def sales(org_id: str, store_id: str, start: str | None, end: str | None) -> dict:
    sb = _sb()
    rows = (sb.table("sales").select("id,total,created_at,status")
            .eq("organization_id", org_id).eq("store_id", store_id)
            .eq("status", "COMPLETED").order("created_at", desc=True)
            .limit(1000).execute().data or [])
    rows = [r for r in rows if _in_range((r["created_at"] or "")[:10], start, end)]
    total = round(sum(float(r["total"]) for r in rows), 2)
    by_day: dict[str, float] = {}
    for r in rows:
        d = (r["created_at"] or "")[:10]
        by_day[d] = round(by_day.get(d, 0) + float(r["total"]), 2)
    pay_rows: list[dict] = []
    if rows:
        ids = [r["id"] for r in rows]
        pays = (sb.table("sale_payments").select("sale_id,payment_method,amount")
                .in_("sale_id", ids).execute().data or [])
        by_m: dict[str, float] = {}
        for p in pays:
            by_m[p["payment_method"]] = round(
                by_m.get(p["payment_method"], 0) + float(p["amount"]), 2)
        pay_rows = [{"method": k, "total": v} for k, v in sorted(by_m.items())]
    n = len(rows)
    return {"total": total, "count": n,
            "average": round(total / n, 2) if n else 0,
            "by_day": [{"day": k, "total": v} for k, v in sorted(by_day.items())],
            "by_method": pay_rows}


def products(org_id: str, store_id: str, start: str | None, end: str | None) -> list[dict]:
    sb = _sb()
    sales_rows = (sb.table("sales").select("id,created_at")
                  .eq("organization_id", org_id).eq("store_id", store_id)
                  .eq("status", "COMPLETED").limit(1000).execute().data or [])
    ids = [r["id"] for r in sales_rows
           if _in_range((r.get("created_at") or "")[:10], start, end)]
    if not ids:
        return []
    items = (sb.table("sale_items")
             .select("product_id,product_name_snapshot,quantity,line_total")
             .in_("sale_id", ids).execute().data or [])
    agg: dict[str, dict] = {}
    for it in items:
        a = agg.setdefault(it["product_id"], {
            "product_id": it["product_id"],
            "product_name": it["product_name_snapshot"],
            "quantity": 0, "revenue": 0.0})
        a["quantity"] = round(a["quantity"] + float(it["quantity"]), 2)
        a["revenue"] = round(a["revenue"] + float(it["line_total"]), 2)
    return sorted(agg.values(), key=lambda r: r["revenue"], reverse=True)


def profit(org_id: str, store_id: str, start: str | None, end: str | None) -> dict:
    sb = _sb()
    sales_rows = (sb.table("sales").select("id,created_at")
                  .eq("organization_id", org_id).eq("store_id", store_id)
                  .eq("status", "COMPLETED").limit(1000).execute().data or [])
    ids = [r["id"] for r in sales_rows
           if _in_range((r.get("created_at") or "")[:10], start, end)]
    revenue = cogs = 0.0
    if ids:
        items = (sb.table("sale_items")
                 .select("quantity,line_total,unit_cost")
                 .in_("sale_id", ids).execute().data or [])
        for it in items:
            revenue += float(it["line_total"])
            cogs += float(it["unit_cost"]) * float(it["quantity"])
    revenue, cogs = round(revenue, 2), round(cogs, 2)
    return {"revenue": revenue, "cogs": cogs,
            "gross_profit": round(revenue - cogs, 2)}


def inventory(org_id: str, store_id: str) -> dict:
    sb = _sb()
    rows = (sb.table("inventory").select("product_id,quantity")
            .eq("store_id", store_id).execute().data or [])
    prods = (sb.table("products")
             .select("id,cost_price,reorder_level")
             .eq("organization_id", org_id).execute().data or [])
    by_id = {p["id"]: p for p in prods}
    value, low = 0.0, 0
    for r in rows:
        p = by_id.get(r["product_id"], {})
        value += float(r["quantity"]) * float(p.get("cost_price") or 0)
        if (p.get("reorder_level") or 0) > 0 and float(r["quantity"]) <= float(p["reorder_level"]):
            low += 1
    return {"lines": len(rows), "stock_value": round(value, 2), "low_stock": low}


def expenses(org_id: str, store_id: str, start: str | None, end: str | None) -> dict:
    sb = _sb()
    rows = (sb.table("expenses").select("amount,category_id,expense_date")
            .eq("organization_id", org_id).eq("store_id", store_id)
            .limit(1000).execute().data or [])
    rows = [r for r in rows if _in_range(r.get("expense_date") or "", start, end)]
    cats = (sb.table("expense_categories").select("id,name")
            .eq("organization_id", org_id).execute().data or [])
    names = {c["id"]: c["name"] for c in cats}
    by_c: dict[str, float] = {}
    total = 0.0
    for r in rows:
        total += float(r["amount"])
        k = names.get(r["category_id"], "Other")
        by_c[k] = round(by_c.get(k, 0) + float(r["amount"]), 2)
    return {"total": round(total, 2),
            "by_category": [{"category": k, "total": v}
                            for k, v in sorted(by_c.items())],
            "from": start or "", "to": end or ""}


def utang(org_id: str) -> dict:
    sb = _sb()
    custs = (sb.table("customers").select("id,name,credit_limit")
             .eq("organization_id", org_id).eq("active", True)
             .execute().data or [])
    if not custs:
        return {"total_outstanding": 0, "customers": []}
    led = (sb.table("customer_ledger").select("customer_id,amount")
           .in_("customer_id", [c["id"] for c in custs]).execute().data or [])
    bal: dict[str, float] = {}
    for e in led:
        bal[e["customer_id"]] = round(bal.get(e["customer_id"], 0) + float(e["amount"]), 2)
    out = [{**c, "balance": bal.get(c["id"], 0)} for c in custs
           if bal.get(c["id"], 0) > 0]
    out.sort(key=lambda r: r["balance"], reverse=True)
    return {"total_outstanding": round(sum(r["balance"] for r in out), 2),
            "customers": out,
            "as_of": date.today().isoformat()}
