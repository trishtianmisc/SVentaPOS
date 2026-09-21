"""Purchase order service. Receiving is atomic via receive_purchase RPC."""
from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError


def _sb():
    from app.core.database import get_supabase_service

    return get_supabase_service()


def _next_po_number(sb, org_id: str, store_id: str) -> str:
    res = (sb.table("purchase_orders").select("po_number")
           .eq("organization_id", org_id).eq("store_id", store_id)
           .order("created_at", desc=True).limit(1).execute())
    rows = res.data or []
    n = 0
    if rows:
        try:
            n = int(str(rows[0]["po_number"]).rsplit("-", 1)[-1])
        except (ValueError, IndexError):
            n = 0
    return f"PO-{(n + 1):05d}"


def create_po(org_id: str, store_id: str, user_id: str,
              supplier_id: str, items: list[dict]) -> dict:
    sb = _sb()
    sup = (sb.table("suppliers").select("id").eq("id", supplier_id)
           .eq("organization_id", org_id).maybe_single().execute())
    if not sup or not sup.data:
        raise NotFoundError("Supplier not found")
    total = 0
    lines = []
    for it in items:
        qty, cost = float(it["quantity"]), float(it["unit_cost"])
        if qty <= 0 or cost < 0:
            raise ValidationAppError("Invalid PO line")
        prod = (sb.table("products").select("id").eq("id", it["product_id"])
                .eq("organization_id", org_id).maybe_single().execute())
        if not prod or not prod.data:
            raise NotFoundError("Product not found")
        line_total = round(qty * cost, 2)
        total += line_total
        lines.append({"product_id": it["product_id"], "quantity": qty,
                      "unit_cost": cost, "line_total": line_total})
    po = (sb.table("purchase_orders").insert({
        "organization_id": org_id, "store_id": store_id,
        "supplier_id": supplier_id,
        "po_number": _next_po_number(sb, org_id, store_id),
        "status": "DRAFT", "total": round(total, 2),
        "created_by": user_id}).execute().data or [None])[0]
    if not po:
        raise ValidationAppError("PO could not be created")
    for ln in lines:
        ln["purchase_order_id"] = po["id"]
    sb.table("purchase_order_items").insert(lines).execute()
    return get_po(org_id, store_id, po["id"])


def get_po(org_id: str, store_id: str, po_id: str) -> dict:
    sb = _sb()
    res = (sb.table("purchase_orders").select("*").eq("id", po_id)
           .eq("organization_id", org_id).eq("store_id", store_id)
           .maybe_single().execute())
    if not res or not res.data:
        raise NotFoundError("Purchase order not found")
    items = (sb.table("purchase_order_items").select("*")
             .eq("purchase_order_id", po_id).execute().data or [])
    return {**res.data, "items": items}


def list_pos(org_id: str, store_id: str) -> list[dict]:
    sb = _sb()
    res = (sb.table("purchase_orders").select("*")
           .eq("organization_id", org_id).eq("store_id", store_id)
           .order("created_at", desc=True).limit(50).execute())
    return res.data or []


def set_status(org_id: str, store_id: str, po_id: str, status: str) -> dict:
    allowed = {"ORDERED", "CANCELLED"}
    if status not in allowed:
        raise ValidationAppError("Invalid status transition")
    sb = _sb()
    po = get_po(org_id, store_id, po_id)
    if po["status"] != "DRAFT":
        raise ConflictError(f"PO is {po['status']}, cannot mark {status}")
    (sb.table("purchase_orders").update({"status": status})
     .eq("id", po_id).execute())
    return get_po(org_id, store_id, po_id)


def receive(org_id: str, store_id: str, user_id: str,
            po_id: str, lines: list[dict]) -> dict:
    sb = _sb()
    get_po(org_id, store_id, po_id)  # validates tenancy
    try:
        res = sb.rpc("receive_purchase", {
            "p_org": org_id, "p_store": store_id, "p_po": po_id,
            "p_user": user_id, "p_lines": lines,
        }).execute()
    except Exception as e:
        raise _map(str(e))
    data = res.data
    if isinstance(data, list):
        data = data[0] if data else {}
    return get_po(org_id, store_id, po_id) if data else {}


def _map(msg: str):
    for code, exc in (
        ("PO_NOT_FOUND", NotFoundError("Purchase order not found")),
        ("PO_ITEM_NOT_FOUND", NotFoundError("PO line not found")),
        ("PO_NOT_RECEIVABLE", ConflictError("PO cannot be received")),
        ("OVER_RECEIVE", ValidationAppError("Quantity exceeds ordered")),
        ("EMPTY_RECEIPT", ValidationAppError("No receive lines")),
        ("INVALID_QTY", ValidationAppError("Invalid quantity")),
    ):
        if code in msg:
            return exc
    return ValidationAppError("Receive failed")
