"""Stock transfer service. Dispatch/receive are atomic via RPCs."""
from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.services import audit_service


def _sb():
    from app.core.database import get_supabase_service

    return get_supabase_service()


def _member_store_ids(sb, org_id: str, user_id: str) -> set[str]:
    """Stores in this org the user belongs to (role check happens in routes)."""
    su = (sb.table("store_users").select("store_id,stores!inner(organization_id)")
          .eq("user_id", user_id).execute())
    return {r["store_id"] for r in (su.data or [])
            if (r.get("stores") or {}).get("organization_id") == org_id}


def _next_reference(sb, org_id: str) -> str:
    res = (sb.table("stock_transfers").select("reference_no")
           .eq("organization_id", org_id)
           .order("created_at", desc=True).limit(1).execute())
    rows = res.data or []
    n = 0
    if rows:
        try:
            n = int(str(rows[0]["reference_no"]).rsplit("-", 1)[-1])
        except (ValueError, IndexError):
            n = 0
    return f"TRF-{(n + 1):05d}"


def _check_stores(sb, org_id: str, user_id: str,
                  from_store: str, to_store: str) -> None:
    if from_store == to_store:
        raise ValidationAppError("Source and destination must differ")
    stores = (sb.table("stores").select("id").eq("organization_id", org_id)
              .in_("id", [from_store, to_store]).execute())
    if len(stores.data or []) != 2:
        raise NotFoundError("Store not found")
    mine = _member_store_ids(sb, org_id, user_id)
    if from_store not in mine or to_store not in mine:
        raise NotFoundError("Store not found")


def create_transfer(org_id: str, user_id: str, from_store: str,
                    to_store: str, items: list[dict]) -> dict:
    sb = _sb()
    _check_stores(sb, org_id, user_id, from_store, to_store)
    lines = []
    for it in items:
        qty = float(it["quantity"])
        if qty <= 0:
            raise ValidationAppError("Invalid transfer line")
        prod = (sb.table("products").select("id").eq("id", it["product_id"])
                .eq("organization_id", org_id).maybe_single().execute())
        if not prod or not prod.data:
            raise NotFoundError("Product not found")
        lines.append({"product_id": it["product_id"], "quantity": qty})
    tr = (sb.table("stock_transfers").insert({
        "organization_id": org_id, "from_store_id": from_store,
        "to_store_id": to_store, "reference_no": _next_reference(sb, org_id),
        "status": "DRAFT", "created_by": user_id}).execute().data or [None])[0]
    if not tr:
        raise ValidationAppError("Transfer could not be created")
    for ln in lines:
        ln["transfer_id"] = tr["id"]
    sb.table("stock_transfer_items").insert(lines).execute()
    audit_service.record(org_id, "transfer.create", "stock_transfer", tr["id"],
                         user_id=user_id, store_id=from_store,
                         metadata={"reference_no": tr["reference_no"],
                                   "to_store_id": to_store,
                                   "lines": len(lines)})
    return get_transfer(org_id, user_id, tr["id"])


def get_transfer(org_id: str, user_id: str, transfer_id: str) -> dict:
    sb = _sb()
    res = (sb.table("stock_transfers").select("*").eq("id", transfer_id)
           .eq("organization_id", org_id).maybe_single().execute())
    if not res or not res.data:
        raise NotFoundError("Transfer not found")
    tr = res.data
    mine = _member_store_ids(sb, org_id, user_id)
    if tr["from_store_id"] not in mine and tr["to_store_id"] not in mine:
        raise NotFoundError("Transfer not found")
    items = (sb.table("stock_transfer_items").select("*")
             .eq("transfer_id", transfer_id).execute().data or [])
    return {**tr, "items": items}


def list_transfers(org_id: str, user_id: str) -> list[dict]:
    sb = _sb()
    mine = _member_store_ids(sb, org_id, user_id)
    res = (sb.table("stock_transfers").select("*")
           .eq("organization_id", org_id)
           .order("created_at", desc=True).limit(50).execute())
    return [r for r in (res.data or [])
            if r["from_store_id"] in mine or r["to_store_id"] in mine]


def dispatch(org_id: str, user_id: str, transfer_id: str) -> dict:
    sb = _sb()
    tr = get_transfer(org_id, user_id, transfer_id)
    if tr["status"] != "DRAFT":
        raise ConflictError(f"Transfer is {tr['status']}, cannot dispatch")
    try:
        sb.rpc("dispatch_transfer", {
            "p_org": org_id, "p_transfer": transfer_id, "p_user": user_id,
        }).execute()
    except Exception as e:
        raise _map(str(e))
    audit_service.record(org_id, "transfer.dispatch", "stock_transfer",
                         transfer_id, user_id=user_id,
                         store_id=tr["from_store_id"],
                         metadata={"reference_no": tr["reference_no"]})
    return get_transfer(org_id, user_id, transfer_id)


def receive(org_id: str, user_id: str, transfer_id: str) -> dict:
    sb = _sb()
    tr = get_transfer(org_id, user_id, transfer_id)
    if tr["status"] != "IN_TRANSIT":
        raise ConflictError(f"Transfer is {tr['status']}, cannot receive")
    try:
        sb.rpc("receive_transfer", {
            "p_org": org_id, "p_transfer": transfer_id, "p_user": user_id,
        }).execute()
    except Exception as e:
        raise _map(str(e))
    audit_service.record(org_id, "transfer.receive", "stock_transfer",
                         transfer_id, user_id=user_id,
                         store_id=tr["to_store_id"],
                         metadata={"reference_no": tr["reference_no"]})
    return get_transfer(org_id, user_id, transfer_id)


def cancel(org_id: str, user_id: str, transfer_id: str) -> dict:
    sb = _sb()
    tr = get_transfer(org_id, user_id, transfer_id)
    if tr["status"] != "DRAFT":
        raise ConflictError(f"Transfer is {tr['status']}, cannot cancel")
    (sb.table("stock_transfers").update({"status": "CANCELLED"})
     .eq("id", transfer_id).execute())
    audit_service.record(org_id, "transfer.cancel", "stock_transfer",
                         transfer_id, user_id=user_id,
                         store_id=tr["from_store_id"],
                         metadata={"reference_no": tr["reference_no"]})
    return get_transfer(org_id, user_id, transfer_id)


def _map(msg: str):
    for code, exc in (
        ("TRANSFER_NOT_FOUND", NotFoundError("Transfer not found")),
        ("TRANSFER_NOT_DISPATCHABLE", ConflictError("Transfer cannot be dispatched")),
        ("TRANSFER_NOT_RECEIVABLE", ConflictError("Transfer cannot be received")),
        ("INSUFFICIENT_STOCK", ConflictError("Insufficient stock at source store")),
    ):
        if code in msg:
            return exc
    return ValidationAppError("Transfer failed")
