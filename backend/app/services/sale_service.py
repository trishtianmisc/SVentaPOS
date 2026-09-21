"""POS sale orchestration via atomic complete_sale / void_sale RPCs.

Server (Postgres) is authoritative for prices, totals, stock, receipt numbers.
Client sends items + payments + idempotency key only (docs/06-pos-sales-flow.md).
"""
from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError


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
    return {**sale, "items": items, "payments": payments}


def list_sales(org_id: str, store_id: str, limit: int = 50) -> list[dict]:
    sb = _sb()
    res = (sb.table("sales").select("*").eq("organization_id", org_id)
           .eq("store_id", store_id).order("created_at", desc=True)
           .limit(limit).execute())
    return res.data or []


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
