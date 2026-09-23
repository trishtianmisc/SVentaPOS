"""Cashier shift service. Open/close are single-row writes; the Z-report
aggregates sale_payments inside the shift window (no sale-path changes)."""
from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.services import audit_service


def _sb():
    from app.core.database import get_supabase_service

    return get_supabase_service()


def current(org_id: str, store_id: str) -> dict | None:
    sb = _sb()
    res = (sb.table("shifts").select("*").eq("organization_id", org_id)
           .eq("store_id", store_id).eq("status", "OPEN")
           .maybe_single().execute())
    row = res.data if res and res.data else None
    if not row:
        return None
    from app.services.user_service import enrich_actor_names
    enrich_actor_names([row], "opened_by", "closed_by")
    return row


def list_shifts(org_id: str, store_id: str, limit: int = 20) -> list[dict]:
    sb = _sb()
    res = (sb.table("shifts").select("*").eq("organization_id", org_id)
           .eq("store_id", store_id).order("opened_at", desc=True)
           .limit(limit).execute())
    from app.services.user_service import enrich_actor_names
    return enrich_actor_names(res.data or [], "opened_by", "closed_by")


def open_shift(org_id: str, store_id: str, user_id: str,
               opening_float: float) -> dict:
    if opening_float < 0:
        raise ValidationAppError("Opening float cannot be negative")
    sb = _sb()
    if current(org_id, store_id):
        raise ConflictError("A shift is already open for this store")
    try:
        res = sb.table("shifts").insert({
            "organization_id": org_id, "store_id": store_id,
            "status": "OPEN", "opened_by": user_id,
            "opening_float": round(opening_float, 2)}).execute()
    except Exception as e:
        # Partial unique index is the backstop for double-open races.
        if "23505" in str(e) or "uplicate" in str(e):
            raise ConflictError("A shift is already open for this store")
        raise
    shift = (res.data or [None])[0]
    if not shift:
        raise ValidationAppError("Shift could not be opened")
    audit_service.record(org_id, "shift.open", "shift", shift["id"],
                         user_id=user_id, store_id=store_id,
                         metadata={"opening_float": shift["opening_float"]})
    from app.services.user_service import enrich_actor_names
    enrich_actor_names([shift], "opened_by", "closed_by")
    return shift


def _z_report(sb, org_id: str, store_id: str, opened_at: str,
              closed_at: str, opening_float: float) -> dict:
    sales = (sb.table("sales").select("id,total,discount_amount,tax_amount")
             .eq("organization_id", org_id).eq("store_id", store_id)
             .eq("status", "COMPLETED")
             .gte("created_at", opened_at).lt("created_at", closed_at)
             .limit(2000).execute().data or [])
    by_method: dict[str, float] = {}
    cash_tendered = change_given = revenue = discounts = vat = 0.0
    if sales:
        pays = (sb.table("sale_payments")
                .select("sale_id,payment_method,amount")
                .in_("sale_id", [s["id"] for s in sales])
                .execute().data or [])
        per_sale: dict[str, dict] = {}
        for p in pays:
            m = p["payment_method"]
            amt = float(p["amount"])
            by_method[m] = round(by_method.get(m, 0) + amt, 2)
            b = per_sale.setdefault(p["sale_id"], {"cash": 0.0, "paid": 0.0})
            if m == "cash":
                b["cash"] += amt
            if m != "utang":
                b["paid"] += amt
        for s in sales:
            revenue += float(s["total"])
            discounts += float(s.get("discount_amount") or 0)
            vat += float(s.get("tax_amount") or 0)
            b = per_sale.get(s["id"], {"cash": 0.0, "paid": 0.0})
            cash_tendered += b["cash"]
            change_given += max(0.0, b["paid"] - float(s["total"]))
    expenses = (sb.table("expenses")
                .select("amount,payment_method,created_at")
                .eq("organization_id", org_id).eq("store_id", store_id)
                .gte("created_at", opened_at).lt("created_at", closed_at)
                .limit(500).execute().data or [])
    cash_expenses = total_expenses = 0.0
    for e in expenses:
        amt = float(e["amount"])
        total_expenses += amt
        if (e.get("payment_method") or "") == "cash":
            cash_expenses += amt
    expected = round(
        opening_float + cash_tendered - change_given - cash_expenses, 2)
    return {"sales_count": len(sales),
            "revenue": round(revenue, 2),
            "discounts": round(discounts, 2),
            "vat_collected": round(vat, 2),
            "by_method": [{"method": k, "total": v}
                          for k, v in sorted(by_method.items())],
            "cash_tendered": round(cash_tendered, 2),
            "change_given": round(change_given, 2),
            "opening_float": round(opening_float, 2),
            "expenses_total": round(total_expenses, 2),
            "cash_expenses": round(cash_expenses, 2),
            "expected_cash": expected}


def close_shift(org_id: str, store_id: str, user_id: str, shift_id: str,
                counted_cash: float, notes: str | None = None) -> dict:
    if counted_cash < 0:
        raise ValidationAppError("Counted cash cannot be negative")
    from datetime import datetime, timezone

    sb = _sb()
    res = (sb.table("shifts").select("*").eq("id", shift_id)
           .eq("organization_id", org_id).eq("store_id", store_id)
           .maybe_single().execute())
    shift = res.data if res and res.data else None
    if not shift:
        raise NotFoundError("Shift not found")
    if shift["status"] != "OPEN":
        raise ConflictError(f"Shift is {shift['status']}, cannot close")
    closed_at = datetime.now(timezone.utc).isoformat()
    z = _z_report(sb, org_id, store_id, shift["opened_at"], closed_at,
                  float(shift.get("opening_float") or 0))
    variance = round(counted_cash - z["expected_cash"], 2)
    upd = (sb.table("shifts").update({
        "status": "CLOSED", "closed_by": user_id, "closed_at": closed_at,
        "expected_cash": z["expected_cash"],
        "counted_cash": round(counted_cash, 2), "variance": variance,
        "notes": (notes or "").strip() or None})
        .eq("id", shift_id).eq("status", "OPEN").execute())
    if not (upd.data or []):
        raise ConflictError("Shift was already closed")
    audit_service.record(org_id, "shift.close", "shift", shift_id,
                         user_id=user_id, store_id=store_id,
                         metadata={"expected_cash": z["expected_cash"],
                                   "counted_cash": round(counted_cash, 2),
                                   "variance": variance,
                                   "sales_count": z["sales_count"]})
    closed = upd.data[0]
    from app.services.user_service import enrich_actor_names
    enrich_actor_names([closed], "opened_by", "closed_by")
    return {**closed, "z_report": z}
