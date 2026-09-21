"""Customer + utang ledger service. Ledger is append-only; balance = sum."""
from app.core.exceptions import NotFoundError, ValidationAppError


def _sb():
    from app.core.database import get_supabase_service

    return get_supabase_service()


def balance_of(customer_id: str) -> float:
    sb = _sb()
    res = (sb.table("customer_ledger").select("amount")
           .eq("customer_id", customer_id).execute())
    return round(sum(float(r["amount"]) for r in (res.data or [])), 2)


def list_customers(org_id: str, search: str | None = None) -> list[dict]:
    sb = _sb()
    q = sb.table("customers").select("*").eq("organization_id", org_id)
    if search:
        q = q.ilike("name", f"%{search}%")
    rows = q.order("name").limit(200).execute().data or []
    if not rows:
        return []
    ids = [r["id"] for r in rows]
    led = (sb.table("customer_ledger").select("customer_id,amount")
           .in_("customer_id", ids).execute().data or [])
    bal: dict[str, float] = {}
    for e in led:
        bal[e["customer_id"]] = round(bal.get(e["customer_id"], 0) + float(e["amount"]), 2)
    return [{**r, "balance": bal.get(r["id"], 0)} for r in rows]


def get_customer(org_id: str, customer_id: str) -> dict:
    sb = _sb()
    res = (sb.table("customers").select("*").eq("id", customer_id)
           .eq("organization_id", org_id).maybe_single().execute())
    if not res or not res.data:
        raise NotFoundError("Customer not found")
    return {**res.data, "balance": balance_of(customer_id)}


def create_customer(org_id: str, data: dict) -> dict:
    sb = _sb()
    res = sb.table("customers").insert(
        {"organization_id": org_id, **data}).execute()
    rows = res.data or []
    if not rows:
        raise ValidationAppError("Customer could not be created")
    return {**rows[0], "balance": 0}


def update_customer(org_id: str, customer_id: str, patch: dict) -> dict:
    sb = _sb()
    allowed = ("name", "phone", "address", "credit_limit", "active")
    clean = {k: v for k, v in patch.items() if k in allowed and v is not None}
    if not clean:
        return get_customer(org_id, customer_id)
    res = (sb.table("customers").update(clean).eq("id", customer_id)
           .eq("organization_id", org_id).execute())
    if not (res.data or []):
        raise NotFoundError("Customer not found")
    return get_customer(org_id, customer_id)


def ledger(org_id: str, customer_id: str, limit: int = 100) -> list[dict]:
    get_customer(org_id, customer_id)  # validates tenancy
    sb = _sb()
    res = (sb.table("customer_ledger").select("*")
           .eq("customer_id", customer_id)
           .order("created_at", desc=True).limit(limit).execute())
    return res.data or []


def record_payment(org_id: str, store_id: str, user_id: str, customer_id: str,
                   amount: float, method: str, reference: str | None,
                   notes: str | None) -> dict:
    sb = _sb()
    # Validates tenancy first.
    get_customer(org_id, customer_id)
    try:
        res = sb.rpc("record_utang_payment", {
            "p_org": org_id, "p_store": store_id, "p_customer": customer_id,
            "p_amount": amount, "p_method": method, "p_user": user_id,
            "p_reference": reference, "p_notes": notes,
        }).execute()
    except Exception as e:
        raise ValidationAppError(_friendly(str(e)))
    data = res.data
    if isinstance(data, list):
        data = data[0] if data else {}
    return data or {}


def _friendly(msg: str) -> str:
    for code in ("INVALID_AMOUNT", "CUSTOMER_NOT_FOUND", "CUSTOMER_INACTIVE"):
        if code in msg:
            return code.replace("_", " ").title()
    return "Payment could not be recorded"
