"""POS sale orchestration via atomic complete_sale / void_sale RPCs.

Server (Postgres) is authoritative for prices, totals, stock, receipt numbers.
Client sends items + payments + idempotency key only (docs/06-pos-sales-flow.md).
"""
from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.core.timezone import local_day_bounds_utc


def _sb():
    from app.core.database import get_supabase_service

    return get_supabase_service()


def complete_sale(org_id: str, store_id: str, cashier_id: str,
                  items: list[dict], payments: list[dict],
                  idempotency_key: str, sale_discount: float = 0,
                  customer_id: str | None = None,
                  limit_override: bool = False,
                  limit_reason: str | None = None) -> dict:
    sb = _sb()
    try:
        res = sb.rpc("complete_sale", {
            "p_org": org_id, "p_store": store_id, "p_cashier": cashier_id,
            "p_items": items, "p_payments": payments,
            "p_idempotency": idempotency_key, "p_customer": customer_id,
            "p_sale_discount": sale_discount,
            "p_limit_override": limit_override,
            "p_limit_reason": limit_reason,
        }).execute()
    except Exception as e:
        raise _map_rpg_error(str(e))
    data = res.data
    if isinstance(data, list):
        data = data[0] if data else {}
    if not data or "sale_id" not in data:
        raise ValidationAppError("Sale could not be completed")
    return data


def get_sale(org_id: str, store_id: str, sale_id: str) -> dict:
    sb = _sb()
    res = (sb.table("sales").select("*").eq("id", sale_id)
           .eq("organization_id", org_id).eq("store_id", store_id)
           .maybe_single().execute())
    if not res or not res.data:
        raise NotFoundError("Sale not found")
    sale = res.data
    items = (sb.table("sale_items").select("*").eq("sale_id", sale_id)
             .execute().data or [])
    payments = (sb.table("sale_payments").select("*").eq("sale_id", sale_id)
                .execute().data or [])
    from app.services.user_service import enrich_actor_names
    enrich_actor_names([sale], "cashier_id", "voided_by")
    _map_sale_actor_names(sale)
    _attach_customer_names([sale])
    paid = round(sum(float(p.get("amount") or 0) for p in payments), 2)
    return {
        **sale,
        "items": items,
        "payments": payments,
        "items_count": len(items),
        "payment_method": (payments[0].get("payment_method") if payments else None),
        "paid": paid or sale.get("total"),
    }


def _map_sale_actor_names(row: dict) -> None:
    """enrich_actor_names writes `<field>_name`; map cashier_id → cashier_name."""
    row["cashier_name"] = row.pop("cashier_id_name", None)


def list_sales(org_id: str, store_id: str, *,
               date_from: str | None = None,
               date_to: str | None = None,
               status: str | None = None,
               payment_method: str | None = None,
               q: str | None = None,
               limit: int = 200) -> list[dict]:
    """Store-scoped sale list with date/status/search filters + list columns.

    Batch-loads customer names, item counts, and primary payment method
    (no N+1). `date_from`/`date_to` are business-local YYYY-MM-DD inclusive
    bounds; converted to UTC instants for `created_at` (stored UTC).
    """
    sb = _sb()
    query = (sb.table("sales").select("*")
             .eq("organization_id", org_id).eq("store_id", store_id))
    if status:
        query = query.eq("status", status.upper())
    if q:
        query = query.ilike("receipt_number", f"%{q.strip()}%")
    if date_from:
        start_utc, _ = local_day_bounds_utc(date_from)
        query = query.gte("created_at", start_utc)
    if date_to:
        # Inclusive end-of-local-day as UTC (created_at is UTC).
        _, end_utc = local_day_bounds_utc(date_to)
        query = query.lte("created_at", end_utc)
    res = query.order("created_at", desc=True).limit(limit).execute()
    rows = res.data or []
    if not rows:
        return []

    from app.services.user_service import enrich_actor_names
    enrich_actor_names(rows, "cashier_id", "voided_by")
    for row in rows:
        _map_sale_actor_names(row)
    _attach_customer_names(rows)
    _attach_item_counts(sb, rows)
    _attach_payments(sb, rows, payment_method)
    return rows


def _attach_customer_names(rows: list[dict]) -> None:
    ids = {str(r["customer_id"]) for r in rows if r.get("customer_id")}
    if not ids:
        for r in rows:
            r.setdefault("customer_name", None)
        return
    try:
        names = (_sb().table("customers").select("id,name")
                 .in_("id", sorted(ids)).execute().data or [])
    except Exception:
        names = []
    by_id = {str(c["id"]): c.get("name") for c in names}
    for r in rows:
        cid = r.get("customer_id")
        r["customer_name"] = by_id.get(str(cid)) if cid else None


def _attach_item_counts(sb, rows: list[dict]) -> None:
    ids = [str(r["id"]) for r in rows]
    counts: dict[str, int] = {i: 0 for i in ids}
    if ids:
        try:
            items = (sb.table("sale_items").select("sale_id")
                     .in_("sale_id", ids).execute().data or [])
            for it in items:
                sid = str(it["sale_id"])
                counts[sid] = counts.get(sid, 0) + 1
        except Exception:
            pass
    for r in rows:
        r["items_count"] = counts.get(str(r["id"]), 0)
        r.setdefault("payment_method", None)


def _attach_payments(sb, rows: list[dict],
                     payment_method: str | None) -> None:
    """Primary method + paid total per sale; optional method filter."""
    ids = [str(r["id"]) for r in rows]
    by_sale: dict[str, list[dict]] = {i: [] for i in ids}
    if ids:
        try:
            pays = (sb.table("sale_payments")
                    .select("sale_id,payment_method,amount")
                    .in_("sale_id", ids).execute().data or [])
            for p in pays:
                by_sale.setdefault(str(p["sale_id"]), []).append(p)
        except Exception:
            pass

    wanted = (payment_method or "").strip().lower() or None
    kept: list[dict] = []
    for r in rows:
        sid = str(r["id"])
        pays = by_sale.get(sid) or []
        primary = pays[0].get("payment_method") if pays else None
        paid = round(sum(float(p.get("amount") or 0) for p in pays), 2)
        r["payment_method"] = primary
        r["paid"] = paid or r.get("total")
        r.setdefault("utang", 0)
        r.setdefault("balance", 0)
        if wanted:
            methods = {(p.get("payment_method") or "").lower() for p in pays}
            if wanted not in methods and (primary or "").lower() != wanted:
                continue
        kept.append(r)
    rows[:] = kept


def void_sale(org_id: str, store_id: str, sale_id: str,
              user_id: str, reason: str) -> dict:
    sb = _sb()
    try:
        res = sb.rpc("void_sale", {
            "p_org": org_id, "p_store": store_id, "p_sale": sale_id,
            "p_user": user_id, "p_reason": reason,
        }).execute()
    except Exception as e:
        raise _map_rpg_error(str(e))
    data = res.data
    if isinstance(data, list):
        data = data[0] if data else {}
    return data or {"sale_id": sale_id, "status": "VOIDED"}


def _map_rpg_error(msg: str):
    for code, exc in (
        ("IDEMPOTENCY_REQUIRED", ValidationAppError("Idempotency key required")),
        ("EMPTY_SALE", ValidationAppError("Sale has no items")),
        ("PRODUCT_NOT_FOUND", NotFoundError("Product not found")),
        ("PRODUCT_INACTIVE", ValidationAppError("Product is inactive")),
        ("INVALID_QTY", ValidationAppError("Invalid quantity")),
        ("INVALID_DISCOUNT", ValidationAppError("Invalid discount")),
        ("INSUFFICIENT_STOCK", ConflictError("Insufficient stock")),
        ("UNDERPAID", ValidationAppError("Payment is less than total")),
        ("STORE_NOT_FOUND", NotFoundError("Store not found")),
        ("SALE_NOT_FOUND", NotFoundError("Sale not found")),
        ("SALE_NOT_VOIDABLE", ConflictError("Sale cannot be voided")),
        ("VOID_REASON_REQUIRED", ValidationAppError("Void reason required")),
        ("UTANG_CUSTOMER_REQUIRED", ValidationAppError("Customer required for utang")),
        ("CUSTOMER_NOT_FOUND", NotFoundError("Customer not found")),
        ("CUSTOMER_INACTIVE", ValidationAppError("Customer is inactive")),
        ("INVALID_UTANG", ValidationAppError("Invalid utang amount")),
        ("CREDIT_LIMIT_EXCEEDED", ConflictError(
            "Credit limit exceeded — confirm override to proceed")),
    ):
        if code in msg:
            if code == "INSUFFICIENT_STOCK":
                return ConflictError(msg.split(":", 1)[-1].strip() or "Insufficient stock")
            return exc
    return ValidationAppError("Sale operation failed")
