"""Phase 4 shifts: open/close lifecycle, Z-report math, hard sale gate.
Service fakes in-memory; routes, gates, envelopes are real."""
import uuid

import pytest

from app.api.v1 import dependencies as deps
from app.main import app
from app.services import audit_service, sale_service, shift_service

ORG = str(uuid.uuid4())
STORE = str(uuid.uuid4())
USER = str(uuid.uuid4())


class _R:
    def __init__(self, data):
        self.data = data


class _T:
    def __init__(self, state, name):
        self.s = state
        self.n = name
        self._single = False
        self._eq: list[tuple] = []
        self._gte: tuple | None = None
        self._lt: tuple | None = None

    def table(self, *a, **k):
        return _T(self.s, a[0])

    def select(self, *a, **k):
        return self

    def eq(self, col, val):
        self._eq.append((col, val))
        return self

    def gte(self, col, val):
        self._gte = (col, val)
        return self

    def lt(self, col, val):
        self._lt = (col, val)
        return self

    def in_(self, *a, **k):
        return self

    def order(self, *a, **k):
        return self

    def limit(self, *a, **k):
        return self

    def maybe_single(self):
        self._single = True
        return self

    def insert(self, row):
        row = {**row, "id": str(uuid.uuid4()),
               "opened_at": "2026-09-22T08:00:00+00:00"}
        if row.get("status") == "OPEN" and any(
                r["status"] == "OPEN" for r in self.s["shifts"]):
            raise Exception("duplicate open shift")
        self.s["shifts"].append(row)
        self._inserted = [row]
        return self

    def update(self, patch):
        self._patch = patch
        return self

    def execute(self):
        if hasattr(self, "_inserted"):
            return _R(self._inserted)
        if self.n == "shifts":
            rows = list(self.s["shifts"])
            for col, val in self._eq:
                rows = [r for r in rows if str(r.get(col)) == str(val)]
            if hasattr(self, "_patch"):
                for r in rows:
                    r.update(self._patch)
                return _R(rows)
            return _R(rows[0] if (self._single and rows) else
                      (None if self._single else rows))
        if self.n == "sales":
            return _R(self.s["sales"])
        if self.n == "sale_payments":
            return _R(self.s["payments"])
        if self.n == "expenses":
            rows = list(self.s.get("expenses", []))
            for col, val in self._eq:
                rows = [r for r in rows if str(r.get(col)) == str(val)]
            if self._gte:
                col, val = self._gte
                rows = [r for r in rows if str(r.get(col) or "") >= str(val)]
            if self._lt:
                col, val = self._lt
                rows = [r for r in rows if str(r.get(col) or "") < str(val)]
            return _R(rows)
        return _R([])


@pytest.fixture()
def ctx4(client, monkeypatch):
    state = {"shifts": [], "sales": [], "payments": [], "audit": [],
             "shift": {"id": "shift-open", "status": "OPEN"}}
    monkeypatch.setattr(shift_service, "_sb", lambda: _T(state, "shifts"))
    monkeypatch.setattr(
        audit_service, "record",
        lambda o, a, e, i="", **k: state["audit"].append(
            {"action": a, "entity_id": i, **k}))

    async def _user():
        return deps.CurrentUser(id=uuid.UUID(USER), email="c@shop.ph",
                                organization_id=uuid.UUID(ORG),
                                stores=[{"store_id": STORE, "role": "cashier"}])

    async def _org():
        return uuid.UUID(ORG)

    async def _store():
        return {"store_id": STORE, "role": "cashier"}

    app.dependency_overrides[deps.get_current_user] = _user
    app.dependency_overrides[deps.get_current_organization] = _org
    app.dependency_overrides[deps.get_current_store] = _store
    # Sale service faked; the hard gate calls the REAL shift_service.current.
    monkeypatch.setattr(sale_service, "complete_sale",
                        lambda *a, **k: {"sale_id": str(uuid.uuid4()),
                                         "receipt_number": "MAIN-00001",
                                         "subtotal": 100, "discount_amount": 0,
                                         "tax_amount": 0, "total": 100,
                                         "status": "COMPLETED"})
    yield state
    app.dependency_overrides.clear()


def _body(client, method, path, **kw):
    r = getattr(client, method)(path, **kw)
    assert r.status_code in (200, 201), r.text
    return r.json()["data"]


def test_shift_lifecycle_with_z_report(ctx4, client):
    opened = _body(client, "post", "/api/v1/shifts/open",
                   json={"opening_float": 500})
    assert opened["status"] == "OPEN"
    assert opened["opening_float"] == 500

    cur = _body(client, "get", "/api/v1/shifts/current")
    assert cur["id"] == opened["id"]

    # Second open is a conflict.
    r = client.post("/api/v1/shifts/open", json={"opening_float": 0})
    assert r.status_code == 409

    # Sales flow through the hard gate while the shift is open.
    sale = _body(client, "post", "/api/v1/sales", json={
        "items": [{"product_id": str(uuid.uuid4()), "quantity": 1}],
        "payments": [{"method": "cash", "amount": 100}],
        "idempotency_key": "z-" + uuid.uuid4().hex[:8]})
    assert sale["status"] == "COMPLETED"

    closed = _body(client, "post", f"/api/v1/shifts/{opened['id']}/close",
                   json={"counted_cash": 500, "notes": "evening"})
    assert closed["status"] == "CLOSED"
    assert closed["variance"] == 0  # no sales rows in fake DB
    assert closed["z_report"]["opening_float"] == 500
    assert closed["z_report"]["expected_cash"] == 500

    # Closing twice is a conflict.
    r = client.post(f"/api/v1/shifts/{opened['id']}/close",
                    json={"counted_cash": 500})
    assert r.status_code == 409

    hist = _body(client, "get", "/api/v1/shifts")
    assert len(hist) == 1 and hist[0]["status"] == "CLOSED"


def test_sales_blocked_without_open_shift(ctx4, client, monkeypatch):
    monkeypatch.setattr(shift_service, "current", lambda o, s: None)
    r = client.post("/api/v1/sales", json={
        "items": [{"product_id": str(uuid.uuid4()), "quantity": 1}],
        "payments": [{"method": "cash", "amount": 100}],
        "idempotency_key": "blocked-" + uuid.uuid4().hex[:8]})
    assert r.status_code == 409
    assert "shift" in r.json()["error"]["message"].lower()


def test_z_math_cash_and_change(monkeypatch):
    state = {
        "shifts": [],
        "sales": [{"id": "s1", "total": 100, "discount_amount": 0}],
        "payments": [
            {"sale_id": "s1", "payment_method": "cash", "amount": 120},
            {"sale_id": "s1", "payment_method": "gcash", "amount": 0},
        ],
        "audit": [],
    }
    monkeypatch.setattr(shift_service, "_sb", lambda: _T(state, "shifts"))
    sb = _T(state, "x")
    z = shift_service._z_report(sb, ORG, STORE, "2026-09-22T00:00:00+00:00",
                                "2026-09-23T00:00:00+00:00", 500)
    assert z["revenue"] == 100
    assert z["cash_tendered"] == 120
    assert z["change_given"] == 20
    assert z["expected_cash"] == 600  # 500 float + 120 cash - 20 change
    assert z["cash_expenses"] == 0
    assert z["expenses_total"] == 0


def test_z_math_cash_expenses_reduce_drawer(monkeypatch):
    state = {
        "shifts": [],
        "sales": [],
        "payments": [],
        "expenses": [
            {"organization_id": ORG, "store_id": STORE, "amount": 50,
             "payment_method": "cash",
             "created_at": "2026-09-22T10:00:00+00:00"},
            {"organization_id": ORG, "store_id": STORE, "amount": 30,
             "payment_method": "gcash",
             "created_at": "2026-09-22T11:00:00+00:00"},
            {"organization_id": ORG, "store_id": STORE, "amount": 99,
             "payment_method": "cash",
             "created_at": "2026-09-24T10:00:00+00:00"},
        ],
        "audit": [],
    }
    monkeypatch.setattr(shift_service, "_sb", lambda: _T(state, "shifts"))
    sb = _T(state, "x")
    z = shift_service._z_report(sb, ORG, STORE, "2026-09-22T00:00:00+00:00",
                                "2026-09-23T00:00:00+00:00", 500)
    assert z["cash_expenses"] == 50
    assert z["expenses_total"] == 80
    assert z["expected_cash"] == 450  # 500 - 50 cash paid out
