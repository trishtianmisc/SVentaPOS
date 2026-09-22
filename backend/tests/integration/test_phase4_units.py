"""Phase 4 C1: product sell-units API + sale line unit_name passthrough.
Service fakes in-memory; routes, gates, envelopes are real. The unit math
itself lives in complete_sale (migration 0015, verified live)."""
import uuid

import pytest

from app.api.v1 import dependencies as deps
from app.core.exceptions import ConflictError, NotFoundError
from app.main import app
from app.schemas.sale import SaleItemIn
from app.services import product_service

ORG = str(uuid.uuid4())
STORE = str(uuid.uuid4())
USER = str(uuid.uuid4())
PID = str(uuid.uuid4())


@pytest.fixture()
def ctxu(client, monkeypatch):
    state = {"units": []}

    async def _user():
        return deps.CurrentUser(id=uuid.UUID(USER), email="o@shop.ph",
                                organization_id=uuid.UUID(ORG),
                                stores=[{"store_id": STORE, "role": "owner"}])

    async def _org():
        return uuid.UUID(ORG)

    async def _store():
        return {"store_id": STORE, "role": "owner"}

    app.dependency_overrides[deps.get_current_user] = _user
    app.dependency_overrides[deps.get_current_organization] = _org
    app.dependency_overrides[deps.get_current_store] = _store

    def _list(org, pid):
        if pid != PID:
            raise NotFoundError("Product not found")
        return [u for u in state["units"] if u["product_id"] == pid]

    def _create(org, pid, data):
        if pid != PID:
            raise NotFoundError("Product not found")
        if (data["unit_name"] or "").lower() == "pc":
            from app.core.exceptions import ValidationAppError

            raise ValidationAppError("'pc' is the implicit base unit")
        if any(u["unit_name"] == data["unit_name"]
               for u in state["units"] if u["product_id"] == pid):
            raise ConflictError("Unit already exists for this product")
        u = {"id": str(uuid.uuid4()), "product_id": pid, **data}
        state["units"].append(u)
        return u

    def _delete(org, pid, uid):
        before = len(state["units"])
        state["units"] = [u for u in state["units"]
                          if not (u["id"] == uid and u["product_id"] == pid)]
        if len(state["units"]) == before:
            raise NotFoundError("Unit not found")

    monkeypatch.setattr(product_service, "list_units", _list)
    monkeypatch.setattr(product_service, "create_unit", _create)
    monkeypatch.setattr(product_service, "delete_unit", _delete)
    yield state
    app.dependency_overrides.clear()


def test_unit_crud(ctxu, client):
    r = client.get(f"/api/v1/products/{PID}/units")
    assert r.status_code == 200 and r.json()["data"] == []

    r = client.post(f"/api/v1/products/{PID}/units", json={
        "unit_name": "case", "conversion_factor": 12,
        "selling_price": 270})
    assert r.status_code == 201, r.text
    uid = r.json()["data"]["id"]
    assert r.json()["data"]["conversion_factor"] == 12

    # Duplicate unit name conflicts.
    r = client.post(f"/api/v1/products/{PID}/units", json={
        "unit_name": "case", "conversion_factor": 12})
    assert r.status_code == 409

    # 'pc' is reserved as the implicit base unit.
    r = client.post(f"/api/v1/products/{PID}/units", json={
        "unit_name": "pc", "conversion_factor": 1})
    assert r.status_code in (400, 422)

    r = client.get(f"/api/v1/products/{PID}/units")
    assert len(r.json()["data"]) == 1

    r = client.delete(f"/api/v1/products/{PID}/units/{uid}")
    assert r.status_code == 200
    r = client.get(f"/api/v1/products/{PID}/units")
    assert r.json()["data"] == []


def test_sale_item_accepts_unit_name():
    item = SaleItemIn(product_id=uuid.uuid4(), quantity=2, unit_name="case")
    assert item.unit_name == "case"
    assert SaleItemIn(product_id=uuid.uuid4(),
                      quantity=1).unit_name is None
