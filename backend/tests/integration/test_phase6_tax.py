"""Phase 6 PH VAT: store tax settings route + RBAC, Z/report VAT sums,
product vat_exempt passthrough. Service fakes in-memory; routes, gates,
envelopes are real. The inclusive VAT math itself lives in complete_sale
(migration 0016, verified live)."""
import uuid

import pytest

from app.api.v1 import dependencies as deps
from app.api.v1.routes import stores as stores_routes
from app.main import app
from app.schemas.store import StoreSettingsUpdate
from app.services import (
    audit_service,
    product_service,
    report_service,
    shift_service,
)

ORG = str(uuid.uuid4())
STORE = str(uuid.uuid4())
USER = str(uuid.uuid4())
PID = str(uuid.uuid4())


class _R:
    def __init__(self, data):
        self.data = data


class _Fake:
    """Minimal chainable supabase fake for the tables each test needs."""

    def __init__(self, state, name=""):
        self.s = state
        self.n = name
        self._eq: list[tuple] = []
        self._patch = None
        self._single = False

    def table(self, name):
        return _Fake(self.s, name)

    def select(self, *a, **k):
        return self

    def eq(self, col, val):
        self._eq.append((col, val))
        return self

    def order(self, *a, **k):
        return self

    def limit(self, *a, **k):
        return self

    def in_(self, *a, **k):
        return self

    def gte(self, col, val):
        self._gte = (col, val)
        return self

    def lt(self, col, val):
        self._lt = (col, val)
        return self

    def maybe_single(self):
        self._single = True
        return self

    def insert(self, row):
        row = {"id": str(uuid.uuid4()), **row}
        self.s.setdefault(self.n, []).append(row)
        return _R([row])

    def update(self, patch):
        self._patch = patch
        return self

    def _rows(self):
        rows = list(self.s.get(self.n, []))
        for col, val in self._eq:
            rows = [r for r in rows if str(r.get(col)) == str(val)]
        if getattr(self, "_gte", None):
            col, val = self._gte
            rows = [r for r in rows if str(r.get(col) or "") >= str(val)]
        if getattr(self, "_lt", None):
            col, val = self._lt
            rows = [r for r in rows if str(r.get(col) or "") < str(val)]
        return rows

    def execute(self):
        if self._patch is not None:
            rows = self._rows()
            for r in rows:
                r.update(self._patch)
            return _R(rows)
        rows = self._rows()
        if self._single:
            return _R(rows[0] if rows else None)
        return _R(rows)


def _base_state():
    return {
        "stores": [{
            "id": STORE, "organization_id": ORG, "name": "Main",
            "code": "MAIN", "status": "active", "address": None,
            "phone": None, "tax_status": "non_vat", "vat_rate": 12,
            "tin": None}],
        "products": [{
            "id": PID, "organization_id": ORG, "category_id": None,
            "name": "Rice", "sku": None, "barcode": None, "brand": None,
            "cost_price": 40, "retail_price": 50, "wholesale_price": None,
            "wholesale_min_qty": None, "minimum_stock": 0, "reorder_level": 0,
            "track_inventory": False, "active": True, "vat_exempt": False}],
        "sales": [], "sale_payments": [], "audit": [],
        "expenses": [], "expense_categories": [],
    }


@pytest.fixture()
def ctx6(client, monkeypatch):
    state = _base_state()
    monkeypatch.setattr(stores_routes, "get_supabase_service",
                        lambda: _Fake(state))
    monkeypatch.setattr(product_service, "_sb", lambda: _Fake(state))
    monkeypatch.setattr(shift_service, "_sb", lambda: _Fake(state))
    monkeypatch.setattr(report_service, "_sb", lambda: _Fake(state))
    monkeypatch.setattr(
        audit_service, "record",
        lambda o, a, e, i="", **k: state["audit"].append(
            {"action": a, "entity_id": i, **k}))

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
    yield state
    app.dependency_overrides.clear()


def _ok(client, method, path, **kw):
    r = getattr(client, method)(path, **kw)
    assert r.status_code in (200, 201), r.text
    return r.json()["data"]


def test_settings_patch_and_audit(ctx6, client):
    got = _ok(client, "patch", "/api/v1/stores/settings", json={
        "tax_status": "vat", "vat_rate": 12, "tin": "123-456-789",
        "address": "Rizal St"})
    assert got["tax_status"] == "vat"
    assert got["tin"] == "123-456-789"
    assert got["address"] == "Rizal St"
    assert any(a["action"] == "store.settings" for a in ctx6["audit"])
    assert ctx6["stores"][0]["tax_status"] == "vat"

    # Empty patch still returns the store.
    got = _ok(client, "patch", "/api/v1/stores/settings", json={})
    assert got["id"] == STORE


def test_settings_rejects_bad_values(ctx6, client):
    r = client.patch("/api/v1/stores/settings",
                     json={"tax_status": "zero_rated"})
    assert r.status_code == 422
    r = client.patch("/api/v1/stores/settings", json={"vat_rate": 101})
    assert r.status_code == 422
    r = client.patch("/api/v1/stores/settings", json={"vat_rate": -1})
    assert r.status_code == 422


def test_settings_cashier_forbidden(ctx6, client):
    async def _cashier_store():
        return {"store_id": STORE, "role": "cashier"}

    app.dependency_overrides[deps.get_current_store] = _cashier_store
    r = client.patch("/api/v1/stores/settings", json={"tin": "x"})
    assert r.status_code == 403


def test_settings_schema_defaults():
    s = StoreSettingsUpdate()
    assert s.tax_status is None and s.vat_rate is None and s.tin is None


def test_z_report_sums_vat(ctx6):
    ctx6["sales"] = [
        {"id": "s1", "organization_id": ORG, "store_id": STORE,
         "total": 112, "discount_amount": 0, "tax_amount": 12,
         "created_at": "2026-09-22T09:00:00+00:00", "status": "COMPLETED"},
        {"id": "s2", "organization_id": ORG, "store_id": STORE,
         "total": 50, "discount_amount": 0, "tax_amount": 0,
         "created_at": "2026-09-22T10:00:00+00:00", "status": "COMPLETED"},
    ]
    ctx6["sale_payments"] = [
        {"sale_id": "s1", "payment_method": "cash", "amount": 112},
        {"sale_id": "s2", "payment_method": "cash", "amount": 50},
    ]
    z = shift_service._z_report(_Fake(ctx6), ORG, STORE,
                                "2026-09-22T00:00:00+00:00",
                                "2026-09-23T00:00:00+00:00", 0)
    assert z["revenue"] == 162
    assert z["vat_collected"] == 12


def test_z_report_deducts_cash_expenses(ctx6):
    ctx6["expenses"] = [
        {"organization_id": ORG, "store_id": STORE, "amount": 40,
         "payment_method": "cash",
         "created_at": "2026-09-22T12:00:00+00:00"},
        {"organization_id": ORG, "store_id": STORE, "amount": 20,
         "payment_method": "gcash",
         "created_at": "2026-09-22T13:00:00+00:00"},
    ]
    z = shift_service._z_report(_Fake(ctx6), ORG, STORE,
                                "2026-09-22T00:00:00+00:00",
                                "2026-09-23T00:00:00+00:00", 500)
    assert z["cash_expenses"] == 40
    assert z["expenses_total"] == 60
    assert z["expected_cash"] == 460


def test_sales_report_rolls_up_vat(ctx6):
    ctx6["sales"] = [{
        "id": "s1", "organization_id": ORG, "store_id": STORE,
        "total": 112, "tax_amount": 12,
        "created_at": "2026-09-22T09:00:00+00:00", "status": "COMPLETED"}]
    rep = report_service.sales(ORG, STORE, None, None)
    assert rep["total"] == 112
    assert rep["vat_collected"] == 12


def test_product_vat_exempt_passthrough(ctx6, client):
    got = _ok(client, "put", f"/api/v1/products/{PID}",
              json={"vat_exempt": True})
    assert got["vat_exempt"] is True
    assert ctx6["products"][0]["vat_exempt"] is True


def test_inclusive_vat_formula():
    """Documents the server formula: tax carved out of vatable net."""
    vatable, rate = 100.0, 12.0
    assert round(vatable * rate / (100 + rate), 2) == 10.71
    assert round(112.0 * rate / (100 + rate), 2) == 12.0
