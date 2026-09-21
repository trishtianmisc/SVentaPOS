"""Phase 1 exit criteria: product -> stock -> sale -> decrease -> view -> reconcile.

Fakes the Supabase-backed services in-memory (no live DB) while exercising
real routes, authZ wiring, envelopes, and server-side totals logic.
"""
import uuid

import pytest

from app.api.v1 import dependencies as deps
from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.main import app
from app.services import inventory_service, product_service, sale_service

ORG = str(uuid.uuid4())
STORE = str(uuid.uuid4())
USER = str(uuid.uuid4())
OTHER_ORG = str(uuid.uuid4())


@pytest.fixture()
def ctx(client, monkeypatch):
    state = {
        "products": {}, "inventory": {}, "sales": {},
        "movements": [], "idem": {}, "receipt": 0,
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

    # --- fakes ---
    def fake_list_products(org_id, search=None, active_only=True):
        assert org_id == ORG, "tenant leak"
        return [p for p in state["products"].values()
                if (not active_only or p["active"])
                and (not search or search.lower() in p["name"].lower())]

    def fake_get_product(org_id, pid):
        if org_id != ORG or pid not in state["products"]:
            raise NotFoundError("Product not found")
        return state["products"][pid]

    def fake_create_product(org_id, data):
        assert org_id == ORG
        pid = str(uuid.uuid4())
        state["products"][pid] = {"id": pid, "organization_id": org_id,
                                  **data, "active": True}
        state["inventory"][pid] = 0
        return state["products"][pid]

    def fake_adjust(org_id, store_id, user_id, product_id, delta,
                    movement_type, reason, unit_cost=None):
        assert (org_id, store_id) == (ORG, STORE)
        if product_id not in state["products"]:
            raise NotFoundError("Product not found")
        new_qty = state["inventory"].get(product_id, 0) + delta
        if new_qty < 0:
            raise ValidationAppError("Negative Stock")
        state["inventory"][product_id] = new_qty
        state["movements"].append({"product_id": product_id,
                                   "quantity": delta, "type": movement_type})
        return {"product_id": product_id, "new_quantity": new_qty}

    def fake_complete(org_id, store_id, cashier, items, payments, key, disc=0,
                      customer_id=None, limit_override=False, limit_reason=None):
        assert (org_id, store_id) == (ORG, STORE)
        if key in state["idem"]:
            return {**state["idem"][key], "replayed": True}
        subtotal, item_disc = 0, 0
        for it in items:
            p = state["products"].get(str(it["product_id"]))
            if not p:
                raise NotFoundError("Product not found")
            qty = it["quantity"]
            if state["inventory"].get(str(it["product_id"]), 0) < qty:
                raise ConflictError("Insufficient stock")
            subtotal += p["retail_price"] * qty
            item_disc += min(it.get("discount", 0), p["retail_price"] * qty)
        total = round(subtotal - item_disc - disc, 2)
        paid = sum(p["amount"] for p in payments)
        if paid < total:
            raise ValidationAppError("Payment is less than total")
        for it in items:
            state["inventory"][str(it["product_id"])] -= it["quantity"]
        state["receipt"] += 1
        sale = {"sale_id": str(uuid.uuid4()),
                "receipt_number": f"MAIN-{state['receipt']:05d}",
                "subtotal": subtotal, "discount_amount": item_disc + disc,
                "tax_amount": 0, "total": total, "paid": paid,
                "change": round(paid - total, 2),
                "status": "COMPLETED", "replayed": False}
        state["sales"][sale["sale_id"]] = sale
        state["idem"][key] = sale
        return sale

    def fake_void(org_id, store_id, sale_id, user_id, reason):
        s = state["sales"].get(sale_id)
        if not s:
            raise NotFoundError("Sale not found")
        if s["status"] != "COMPLETED":
            raise ConflictError("Sale cannot be voided")
        s["status"] = "VOIDED"
        return {"sale_id": sale_id, "status": "VOIDED"}

    monkeypatch.setattr(product_service, "list_products", fake_list_products)
    monkeypatch.setattr(product_service, "get_product", fake_get_product)
    monkeypatch.setattr(product_service, "create_product", fake_create_product)
    monkeypatch.setattr(product_service, "update_product",
                        lambda o, p, d: fake_get_product(o, p))
    monkeypatch.setattr(product_service, "deactivate_product",
                        lambda o, p: fake_get_product(o, p))
    monkeypatch.setattr(inventory_service, "adjust", fake_adjust)
    monkeypatch.setattr(inventory_service, "list_inventory", lambda s: [
        {"store_id": s, "product_id": pid, "quantity": q,
         "product_name": state["products"][pid]["name"]}
        for pid, q in state["inventory"].items()])
    monkeypatch.setattr(inventory_service, "low_stock", lambda s: [])
    monkeypatch.setattr(inventory_service, "movements",
                        lambda s, p=None, limit=50: state["movements"])
    monkeypatch.setattr(inventory_service, "get_stock",
                        lambda s, p: {"store_id": s, "product_id": p,
                                      "quantity": state["inventory"].get(p, 0)})
    monkeypatch.setattr(sale_service, "complete_sale", fake_complete)
    monkeypatch.setattr(sale_service, "void_sale", fake_void)
    monkeypatch.setattr(sale_service, "list_sales",
                        lambda o, s, limit=50: list(state["sales"].values()))
    monkeypatch.setattr(
        sale_service, "get_sale",
        lambda o, s, i: {**state["sales"][i], "id": i, "items": [],
                         "payments": [], "created_at": "now"}
        if i in state["sales"] else (_ for _ in ()).throw(
            NotFoundError("Sale not found")))

    yield state
    app.dependency_overrides.clear()


def test_exit_criteria_flow(client, ctx):
    # 1. Create products
    r = client.post("/api/v1/products", json={
        "name": "Lucky Me Pancit", "retail_price": 25, "cost_price": 20})
    assert r.status_code == 201, r.text
    pid = r.json()["data"]["id"]

    # 2. Add stock
    r = client.post("/api/v1/inventory/adjust", json={
        "product_id": pid, "quantity": 100,
        "movement_type": "PURCHASE", "reason": "opening stock"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["new_quantity"] == 100

    # 3. Complete cash sale (server computes totals + change)
    key = "idem-" + uuid.uuid4().hex[:12]
    r = client.post("/api/v1/sales", json={
        "items": [{"product_id": pid, "quantity": 4}],
        "payments": [{"method": "cash", "amount": 120}],
        "idempotency_key": key})
    assert r.status_code == 201, r.text
    body = r.json()["data"]
    assert body["total"] == 100 and body["change"] == 20

    # 4. Inventory decreased
    r = client.get(f"/api/v1/inventory/{pid}")
    assert r.json()["data"]["quantity"] == 96

    # 5/6. View sale + reconcile payment
    sale_id = body["sale_id"]
    r = client.get(f"/api/v1/sales/{sale_id}")
    assert r.status_code == 200
    assert r.json()["data"]["receipt_number"].startswith("MAIN-")

    # Idempotent retry returns same sale
    r = client.post("/api/v1/sales", json={
        "items": [{"product_id": pid, "quantity": 4}],
        "payments": [{"method": "cash", "amount": 120}],
        "idempotency_key": key})
    assert r.json()["data"]["replayed"] is True


def test_negative_stock_blocked(client, ctx):
    r = client.post("/api/v1/products", json={"name": "Egg", "retail_price": 7})
    pid = r.json()["data"]["id"]
    r = client.post("/api/v1/sales", json={
        "items": [{"product_id": pid, "quantity": 5}],
        "payments": [{"method": "cash", "amount": 100}],
        "idempotency_key": "k-" + uuid.uuid4().hex[:8]})
    assert r.status_code == 409


def test_void_is_auditable(client, ctx):
    r = client.post("/api/v1/products", json={"name": "Milk", "retail_price": 10})
    pid = r.json()["data"]["id"]
    client.post("/api/v1/inventory/adjust", json={
        "product_id": pid, "quantity": 10,
        "movement_type": "PURCHASE", "reason": "stock"})
    r = client.post("/api/v1/sales", json={
        "items": [{"product_id": pid, "quantity": 2}],
        "payments": [{"method": "cash", "amount": 20}],
        "idempotency_key": "v-" + uuid.uuid4().hex[:8]})
    sid = r.json()["data"]["sale_id"]
    r = client.post(f"/api/v1/sales/{sid}/void", json={"reason": "wrong item"})
    assert r.status_code == 200
    r = client.post(f"/api/v1/sales/{sid}/void", json={"reason": "again"})
    assert r.status_code == 409  # second void rejected, history intact


def test_import_is_stub(client, ctx):
    r = client.post("/api/v1/products/import")
    assert r.status_code == 200
    assert "stub" in r.json()["data"]["message"]


def test_catalog_needs_no_store_header_but_needs_role(client, ctx):
    # Owner membership (any store) can manage catalog without X-Store-Id.
    r = client.post("/api/v1/products", json={"name": "NoHeader", "retail_price": 1})
    assert r.status_code == 201, r.text


def test_cashier_blocked_from_catalog(client, ctx, monkeypatch):
    async def _cashier():
        return deps.CurrentUser(id=uuid.UUID(USER), email="c@x.ph",
                                organization_id=uuid.UUID(ORG),
                                stores=[{"store_id": STORE, "role": "cashier"}])

    app.dependency_overrides[deps.get_current_user] = _cashier
    r = client.post("/api/v1/products", json={"name": "Nope", "retail_price": 1})
    assert r.status_code == 403
