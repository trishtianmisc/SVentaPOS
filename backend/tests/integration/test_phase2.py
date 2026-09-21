"""Phase 2: utang ledger, credit limits, wholesale tier, PO receive,
expenses, reports. In-memory fakes; routes + envelopes are real."""
import uuid

import pytest

from app.api.v1 import dependencies as deps
from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.main import app
from app.services import (
    audit_service,
    customer_service,
    expense_service,
    notification_service,
    purchase_service,
    report_service,
    sale_service,
    subscription_service,
)

ORG = str(uuid.uuid4())
STORE = str(uuid.uuid4())
USER = str(uuid.uuid4())


@pytest.fixture()
def ctx2(client, monkeypatch):
    state = {
        "customers": {}, "ledger": [], "pos": {}, "po_items": {},
        "inventory": {}, "expenses": [], "sales": [],
    }

    async def _user():
        return deps.CurrentUser(id=uuid.UUID(USER), email="t@x.ph",
                                organization_id=uuid.UUID(ORG),
                                stores=[{"store_id": STORE, "role": "owner"}])

    async def _org():
        return uuid.UUID(ORG)

    async def _store():
        return {"store_id": STORE, "role": "owner"}

    app.dependency_overrides[deps.get_current_user] = _user
    app.dependency_overrides[deps.get_current_organization] = _org
    app.dependency_overrides[deps.get_current_store] = _store

    def bal(cid):
        return round(sum(e["amount"] for e in state["ledger"]
                         if e["customer_id"] == cid), 2)

    # --- customers ---
    monkeypatch.setattr(customer_service, "list_customers",
                        lambda o, s=None: [
                            {**c, "balance": bal(c["id"])}
                            for c in state["customers"].values()])
    monkeypatch.setattr(customer_service, "get_customer",
                        lambda o, c: {**state["customers"][c],
                                      "balance": bal(c)}
                        if c in state["customers"] else (_ for _ in ()).throw(
                            NotFoundError("Customer not found")))

    def _create(org, data):
        cid = str(uuid.uuid4())
        state["customers"][cid] = {"id": cid, "organization_id": org,
                                   **data, "active": True}
        return {**state["customers"][cid], "balance": 0}

    monkeypatch.setattr(customer_service, "create_customer", _create)
    monkeypatch.setattr(customer_service, "ledger",
                        lambda o, c, limit=100: [
                            e for e in state["ledger"] if e["customer_id"] == c])

    def _pay(org, store, user, cid, amount, method, ref, notes):
        if cid not in state["customers"]:
            raise NotFoundError("Customer not found")
        if amount <= 0:
            raise ValidationAppError("Invalid Amount")
        state["ledger"].append({"id": str(uuid.uuid4()), "customer_id": cid,
                                "transaction_type": "PAYMENT",
                                "amount": -amount, "created_at": "now"})
        return {"customer_id": cid, "paid": amount, "balance": bal(cid)}

    monkeypatch.setattr(customer_service, "record_payment", _pay)

    # --- sales with wholesale + utang ---
    prices = {"p1": (10.0, 8.0, 5)}  # retail, wholesale, min qty

    def _complete(org, store, cashier, items, payments, key, disc=0,
                  customer_id=None, limit_override=False, limit_reason=None):
        sub = 0
        for it in items:
            retail, whole, minq = prices["p1"]
            price = whole if it["quantity"] >= minq else retail
            sub += price * it["quantity"]
        total = round(sub - disc, 2)
        utang = sum(p["amount"] for p in payments if p["method"] == "utang")
        paid = sum(p["amount"] for p in payments)
        if paid < total:
            raise ValidationAppError("Payment is less than total")
        if utang:
            if not customer_id or customer_id not in state["customers"]:
                raise NotFoundError("Customer not found")
            c = state["customers"][customer_id]
            if c.get("credit_limit") is not None and \
               bal(customer_id) + utang > c["credit_limit"] and not limit_override:
                raise ConflictError("Credit limit exceeded")
            state["ledger"].append(
                {"id": str(uuid.uuid4()), "customer_id": customer_id,
                 "transaction_type": "CREDIT_SALE", "amount": utang,
                 "created_at": "now"})
        sale = {"sale_id": str(uuid.uuid4()), "receipt_number": "R-1",
                "subtotal": sub, "discount_amount": disc, "tax_amount": 0,
                "total": total, "paid": paid, "change": round(paid - total, 2),
                "status": "COMPLETED", "replayed": False,
                "customer_id": customer_id, "utang": utang,
                "balance": bal(customer_id) if customer_id else 0}
        state["sales"].append({**sale, "created_at": "2026-01-01T00:00:00"})
        return sale

    monkeypatch.setattr(sale_service, "complete_sale", _complete)
    # Phase 3 cross-cutting calls: no-op fakes (no network in tests).
    monkeypatch.setattr(subscription_service, "check_limit", lambda o, r: None)
    monkeypatch.setattr(audit_service, "record", lambda *a, **k: None)
    monkeypatch.setattr(notification_service, "notify", lambda *a, **k: None)

    # --- purchasing ---
    def _create_po(org, store, user, sup, items):
        pid = str(uuid.uuid4())
        total = sum(i["quantity"] * i["unit_cost"] for i in items)
        state["pos"][pid] = {"id": pid, "supplier_id": sup,
                             "po_number": "PO-00001", "status": "DRAFT",
                             "total": total, "created_at": "now", "items": [
                                 {**i, "id": str(uuid.uuid4()),
                                  "received_qty": 0} for i in items]}
        return state["pos"][pid]

    def _receive(org, store, user, pid, lines):
        po = state["pos"][pid]
        if po["status"] not in ("ORDERED", "PARTIAL"):
            raise ConflictError("PO cannot be received")
        for ln in lines:
            it = next(i for i in po["items"] if i["id"] == ln["item_id"])
            if ln["quantity"] > it["quantity"] - it["received_qty"]:
                raise ValidationAppError("Quantity exceeds ordered")
            it["received_qty"] += ln["quantity"]
        po["status"] = "RECEIVED" if all(
            i["received_qty"] >= i["quantity"] for i in po["items"]) else "PARTIAL"
        return po

    monkeypatch.setattr(purchase_service, "create_po", _create_po)
    monkeypatch.setattr(purchase_service, "get_po",
                        lambda o, s, p: state["pos"][p])
    monkeypatch.setattr(purchase_service, "list_pos",
                        lambda o, s: list(state["pos"].values()))
    monkeypatch.setattr(purchase_service, "receive", _receive)

    # --- expenses / reports ---
    monkeypatch.setattr(expense_service, "ensure_defaults",
                        lambda o: [{"id": str(uuid.uuid4()), "name": n,
                                    "active": True} for n in
                                   ["Rent", "Utilities", "Other"]])
    monkeypatch.setattr(expense_service, "list_categories", lambda o: [])
    monkeypatch.setattr(expense_service, "create_expense",
                        lambda o, s, u, d: {**d, "id": str(uuid.uuid4()),
                                            "category_name": "Rent",
                                            "expense_date": "2026-01-01"})
    monkeypatch.setattr(expense_service, "list_expenses", lambda o, s, limit=100: [])
    monkeypatch.setattr(report_service, "sales",
                        lambda o, s, f, t: {"total": 100, "count": 1,
                                            "average": 100, "by_day": [],
                                            "by_method": []})
    monkeypatch.setattr(report_service, "profit",
                        lambda o, s, f, t: {"revenue": 100, "cogs": 60,
                                            "gross_profit": 40})
    monkeypatch.setattr(report_service, "utang",
                        lambda o: {"total_outstanding": 50, "customers": []})

    yield state
    app.dependency_overrides.clear()


def test_utang_flow(client, ctx2):
    r = client.post("/api/v1/customers", json={"name": "Aling Maria"})
    cid = r.json()["data"]["id"]
    assert r.json()["data"]["balance"] == 0

    # Credit sale posts to ledger
    r = client.post("/api/v1/sales", json={
        "items": [{"product_id": str(uuid.uuid4()), "quantity": 2}],
        "payments": [{"method": "utang", "amount": 20}],
        "customer_id": cid, "idempotency_key": "u-" + uuid.uuid4().hex[:8]})
    assert r.status_code == 201, r.text
    assert r.json()["data"]["utang"] == 20

    r = client.get(f"/api/v1/customers/{cid}")
    assert r.json()["data"]["balance"] == 20

    # Partial payment reduces balance; ledger keeps both rows
    r = client.post(f"/api/v1/customers/{cid}/payment", json={
        "amount": 8, "method": "cash"})
    assert r.json()["data"]["balance"] == 12
    r = client.get(f"/api/v1/customers/{cid}/ledger")
    assert len(r.json()["data"]) == 2


def test_credit_limit_warn_override(client, ctx2):
    r = client.post("/api/v1/customers",
                    json={"name": "Jun", "credit_limit": 100})
    cid = r.json()["data"]["id"]
    body = {"items": [{"product_id": str(uuid.uuid4()), "quantity": 20}],
            "payments": [{"method": "utang", "amount": 200}],
            "customer_id": cid}
    r = client.post("/api/v1/sales", json={
        **body, "idempotency_key": "l1-" + uuid.uuid4().hex[:8]})
    assert r.status_code == 409  # blocked without override
    r = client.post("/api/v1/sales", json={
        **body, "idempotency_key": "l2-" + uuid.uuid4().hex[:8],
        "limit_override": True, "limit_reason": "manager approved"})
    assert r.status_code == 201


def test_wholesale_tier(client, ctx2):
    r = client.post("/api/v1/customers", json={"name": "W"})
    cid = r.json()["data"]["id"]
    pid = str(uuid.uuid4())
    # qty 2 -> retail 10; qty 6 -> wholesale 8
    for qty, total in ((2, 20), (6, 48)):
        r = client.post("/api/v1/sales", json={
            "items": [{"product_id": pid, "quantity": qty}],
            "payments": [{"method": "cash", "amount": total}],
            "idempotency_key": "w-" + uuid.uuid4().hex[:8]})
        assert r.json()["data"]["total"] == total, r.text


def test_po_receive(client, ctx2):
    sup = str(uuid.uuid4())
    r = client.post("/api/v1/purchase-orders", json={
        "supplier_id": sup,
        "items": [{"product_id": str(uuid.uuid4()), "quantity": 10,
                   "unit_cost": 5}]})
    assert r.status_code == 201, r.text
    pid = r.json()["data"]["id"]
    item_id = r.json()["data"]["items"][0]["id"]
    # Must be ORDERED before receiving
    r = client.post(f"/api/v1/purchase-orders/{pid}/receive",
                    json={"lines": [{"item_id": item_id, "quantity": 4}]})
    assert r.status_code == 409
    # Approve via service-level status then receive (fake has no approve
    # route wiring for DRAFT->ORDERED in fakes; emulate by direct state)
    ctx2["pos"][pid]["status"] = "ORDERED"
    r = client.post(f"/api/v1/purchase-orders/{pid}/receive",
                    json={"lines": [{"item_id": item_id, "quantity": 4}]})
    assert r.json()["data"]["status"] == "PARTIAL"
    r = client.post(f"/api/v1/purchase-orders/{pid}/receive",
                    json={"lines": [{"item_id": item_id, "quantity": 6}]})
    assert r.json()["data"]["status"] == "RECEIVED"


def test_expenses_and_reports(client, ctx2):
    r = client.post("/api/v1/expenses/categories")
    assert r.status_code == 200
    assert len(r.json()["data"]) == 3
    r = client.get("/api/v1/reports/sales")
    assert r.json()["data"]["total"] == 100
    r = client.get("/api/v1/reports/profit")
    assert r.json()["data"]["gross_profit"] == 40
    r = client.get("/api/v1/reports/utang")
    assert r.json()["data"]["total_outstanding"] == 50


def test_utang_requires_customer(client, ctx2):
    r = client.post("/api/v1/sales", json={
        "items": [{"product_id": str(uuid.uuid4()), "quantity": 1}],
        "payments": [{"method": "utang", "amount": 10}],
        "idempotency_key": "n-" + uuid.uuid4().hex[:8]})
    assert r.status_code in (404, 422)
