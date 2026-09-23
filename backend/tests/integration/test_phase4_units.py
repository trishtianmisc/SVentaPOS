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

    def _update(org, pid, uid, patch):
        if pid != PID:
            raise NotFoundError("Product not found")
        for u in state["units"]:
            if u["id"] == uid and u["product_id"] == pid:
                if "unit_name" in patch:
                    name = (patch["unit_name"] or "").strip()
                    if not name:
                        from app.core.exceptions import ValidationAppError

                        raise ValidationAppError("Unit name required")
                    if name.lower() == "pc":
                        from app.core.exceptions import ValidationAppError

                        raise ValidationAppError(
                            "'pc' is the implicit base unit")
                    if any(
                        other["unit_name"] == name
                        for other in state["units"]
                        if other["product_id"] == pid and other["id"] != uid
                    ):
                        raise ConflictError(
                            "Unit already exists for this product")
                    u["unit_name"] = name
                if "conversion_factor" in patch:
                    cf = patch["conversion_factor"]
                    if cf is None or cf <= 0:
                        from app.core.exceptions import ValidationAppError

                        raise ValidationAppError(
                            "Conversion factor must be greater than 0")
                    u["conversion_factor"] = cf
                if "selling_price" in patch:
                    u["selling_price"] = patch["selling_price"]
                if "cost_price" in patch:
                    u["cost_price"] = patch["cost_price"]
                if "barcode" in patch:
                    u["barcode"] = patch["barcode"] or None
                return u
        raise NotFoundError("Unit not found")

    monkeypatch.setattr(product_service, "list_units", _list)
    monkeypatch.setattr(product_service, "create_unit", _create)
    monkeypatch.setattr(product_service, "delete_unit", _delete)
    monkeypatch.setattr(product_service, "update_unit", _update)
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


def test_unit_update(ctxu, client):
    r = client.post(f"/api/v1/products/{PID}/units", json={
        "unit_name": "case", "conversion_factor": 12})
    assert r.status_code == 201, r.text
    uid = r.json()["data"]["id"]

    # Rename + change factor + set price + barcode.
    r = client.put(f"/api/v1/products/{PID}/units/{uid}", json={
        "unit_name": "carton",
        "conversion_factor": 24,
        "selling_price": 300,
        "barcode": "CASE-24"})
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["unit_name"] == "carton"
    assert data["conversion_factor"] == 24
    assert data["selling_price"] == 300
    assert data["barcode"] == "CASE-24"

    # Clear optional selling price with null.
    r = client.put(f"/api/v1/products/{PID}/units/{uid}",
                   json={"selling_price": None})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["selling_price"] is None

    # Invalid factor rejected by schema (gt=0).
    r = client.put(f"/api/v1/products/{PID}/units/{uid}",
                   json={"conversion_factor": 0})
    assert r.status_code == 422

    # 'pc' reserved as base unit name.
    r = client.put(f"/api/v1/products/{PID}/units/{uid}",
                   json={"unit_name": "pc"})
    assert r.status_code in (400, 409, 422)

    # Add a second unit, then duplicate name conflicts.
    r = client.post(f"/api/v1/products/{PID}/units", json={
        "unit_name": "pack", "conversion_factor": 10})
    assert r.status_code == 201
    pack_id = r.json()["data"]["id"]
    r = client.put(f"/api/v1/products/{PID}/units/{pack_id}",
                   json={"unit_name": "carton"})
    assert r.status_code == 409
