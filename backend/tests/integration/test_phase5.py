"""Phase 5: transfers state machine, consolidated merging, forecast math.
Service layer faked at route level; real merging/forecast logic tested
against small fakes."""
import uuid

import pytest

from app.api.v1 import dependencies as deps
from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.main import app
from app.services import (
    forecast_service,
    report_service,
    subscription_service,
    transfer_service,
)

ORG = str(uuid.uuid4())
STORE_A = str(uuid.uuid4())
STORE_B = str(uuid.uuid4())
USER = str(uuid.uuid4())


@pytest.fixture()
def ctx5(client, monkeypatch):
    state = {"transfers": {}, "items": {}, "seq": 0}

    async def _user():
        return deps.CurrentUser(
            id=uuid.UUID(USER), email="o@shop.ph",
            organization_id=uuid.UUID(ORG),
            stores=[{"store_id": STORE_A, "role": "owner"},
                    {"store_id": STORE_B, "role": "manager"}])

    async def _org():
        return uuid.UUID(ORG)

    async def _store():
        return {"store_id": STORE_A, "role": "owner"}

    app.dependency_overrides[deps.get_current_user] = _user
    app.dependency_overrides[deps.get_current_organization] = _org
    app.dependency_overrides[deps.get_current_store] = _store

    def _get(tid):
        if tid not in state["transfers"]:
            raise NotFoundError("Transfer not found")
        return {**state["transfers"][tid],
                "items": state["items"].get(tid, [])}

    def _create(org, user, frm, to, items):
        if frm == to:
            raise ValidationAppError("Source and destination must differ")
        state["seq"] += 1
        tid = str(uuid.uuid4())
        state["transfers"][tid] = {
            "id": tid, "reference_no": f"TRF-{state['seq']:05d}",
            "from_store_id": frm, "to_store_id": to, "status": "DRAFT",
            "created_at": "2026-01-01T00:00:00",
            "dispatched_at": None, "received_at": None}
        state["items"][tid] = [
            {"id": str(uuid.uuid4()), "transfer_id": tid,
             "product_id": i["product_id"], "quantity": i["quantity"]}
            for i in items]
        return _get(tid)

    def _dispatch(org, user, tid):
        tr = _get(tid)
        if tr["status"] != "DRAFT":
            raise ConflictError(f"Transfer is {tr['status']}, cannot dispatch")
        state["transfers"][tid]["status"] = "IN_TRANSIT"
        return _get(tid)

    def _receive(org, user, tid):
        tr = _get(tid)
        if tr["status"] != "IN_TRANSIT":
            raise ConflictError(f"Transfer is {tr['status']}, cannot receive")
        state["transfers"][tid]["status"] = "RECEIVED"
        return _get(tid)

    def _cancel(org, user, tid):
        tr = _get(tid)
        if tr["status"] != "DRAFT":
            raise ConflictError(f"Transfer is {tr['status']}, cannot cancel")
        state["transfers"][tid]["status"] = "CANCELLED"
        return _get(tid)

    monkeypatch.setattr(transfer_service, "create_transfer", _create)
    monkeypatch.setattr(transfer_service, "get_transfer", _get)
    monkeypatch.setattr(
        transfer_service, "list_transfers",
        lambda o, u: [{**t, "items": state["items"].get(t["id"], [])}
                      for t in state["transfers"].values()])
    monkeypatch.setattr(transfer_service, "dispatch", _dispatch)
    monkeypatch.setattr(transfer_service, "receive", _receive)
    monkeypatch.setattr(transfer_service, "cancel", _cancel)
    # Advanced-report gate (Phase 7): open in this fixture's world.
    monkeypatch.setattr(subscription_service, "require_feature",
                        lambda o, f: None)
    yield state
    app.dependency_overrides.clear()


def _body(client, method, path, **kw):
    r = getattr(client, method)(path, **kw)
    assert r.status_code in (200, 201), r.text
    payload = r.json()
    assert "data" in payload, r.text
    return payload["data"]


def test_transfer_lifecycle(ctx5, client):
    pid = str(uuid.uuid4())
    tr = _body(client, "post", "/api/v1/transfers", json={
        "from_store_id": STORE_A, "to_store_id": STORE_B,
        "items": [{"product_id": pid, "quantity": 6}]})
    assert tr["reference_no"] == "TRF-00001"
    assert tr["status"] == "DRAFT"
    assert tr["items"][0]["quantity"] == 6

    tr = _body(client, "post", f"/api/v1/transfers/{tr['id']}/dispatch")
    assert tr["status"] == "IN_TRANSIT"

    # Double dispatch is a conflict.
    r = client.post(f"/api/v1/transfers/{tr['id']}/dispatch")
    assert r.status_code == 409

    tr = _body(client, "post", f"/api/v1/transfers/{tr['id']}/receive")
    assert tr["status"] == "RECEIVED"

    # Cancelling a received transfer is a conflict.
    r = client.post(f"/api/v1/transfers/{tr['id']}/cancel")
    assert r.status_code == 409

    lst = _body(client, "get", "/api/v1/transfers")
    assert len(lst) == 1


def test_transfer_self_rejected(ctx5, client):
    r = client.post("/api/v1/transfers", json={
        "from_store_id": STORE_A, "to_store_id": STORE_A,
        "items": [{"product_id": str(uuid.uuid4()), "quantity": 1}]})
    assert r.status_code == 422 or r.status_code == 400


def test_transfer_cancel_draft(ctx5, client):
    tr = _body(client, "post", "/api/v1/transfers", json={
        "from_store_id": STORE_A, "to_store_id": STORE_B,
        "items": [{"product_id": str(uuid.uuid4()), "quantity": 2}]})
    tr = _body(client, "post", f"/api/v1/transfers/{tr['id']}/cancel")
    assert tr["status"] == "CANCELLED"


def test_consolidated_sales_merges(monkeypatch):
    stores = [{"id": "s1", "name": "Main"}, {"id": "s2", "name": "Branch"}]
    monkeypatch.setattr(report_service, "_org_stores", lambda o: stores)
    monkeypatch.setattr(
        report_service, "sales",
        lambda o, s, f, t: {
            "total": 100.0 if s == "s1" else 50.0, "count": 1, "average": 0,
            "by_day": [{"day": "2026-01-01", "total": 100.0 if s == "s1" else 50.0}],
            "by_method": [{"method": "cash", "total": 100.0 if s == "s1" else 50.0}]})
    out = report_service.consolidated_sales("org", None, None)
    assert out["total"] == 150.0
    assert out["count"] == 2
    assert out["by_day"] == [{"day": "2026-01-01", "total": 150.0}]
    assert [p["store_name"] for p in out["by_store"]] == ["Main", "Branch"]


def test_consolidated_routes(ctx5, client, monkeypatch):
    monkeypatch.setattr(
        report_service, "consolidated_sales",
        lambda o, f, t: {"total": 1, "count": 1, "average": 1,
                         "by_day": [], "by_method": [], "by_store": []})
    monkeypatch.setattr(
        report_service, "consolidated_profit",
        lambda o, f, t: {"revenue": 1, "cogs": 0, "gross_profit": 1,
                         "by_store": []})
    monkeypatch.setattr(
        report_service, "consolidated_expenses",
        lambda o, f, t: {"total": 0, "by_category": [], "by_store": [],
                         "from": "", "to": ""})
    monkeypatch.setattr(
        report_service, "consolidated_inventory",
        lambda o: {"lines": 0, "stock_value": 0, "low_stock": 0,
                   "by_store": []})
    for path in ("sales?from=2026-01-01", "profit", "expenses", "inventory"):
        data = _body(client, "get", f"/api/v1/reports/consolidated/{path}")
        assert "by_store" in data


class _FakeQ:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *a, **k):
        return self

    def eq(self, *a, **k):
        return self

    def gte(self, *a, **k):
        return self

    def in_(self, *a, **k):
        return self

    def limit(self, *a, **k):
        return self

    def order(self, *a, **k):
        return self

    def execute(self):
        return type("R", (), {"data": self._rows})()


class _FakeSB:
    def __init__(self, tables):
        self._t = tables

    def table(self, name):
        return _FakeQ(self._t.get(name, []))


def test_forecast_math(monkeypatch):
    pid = str(uuid.uuid4())
    sale_id = str(uuid.uuid4())
    fake = _FakeSB({
        "sales": [{"id": sale_id, "created_at": "2026-09-20T00:00:00"}],
        "sale_items": [{"product_id": pid, "quantity": 28}],
        "inventory": [{"product_id": pid, "quantity": 6}],
        "products": [{"id": pid, "name": "Coffee", "cost_price": 50,
                      "reorder_level": 10, "track_inventory": True}],
    })
    monkeypatch.setattr(forecast_service, "_sb", lambda: fake)
    out = forecast_service.forecast("org", "store", 14)
    assert out["window_days"] == 14 and out["estimate"] is True
    row = out["rows"][0]
    assert row["sold_in_window"] == 28
    assert row["daily_velocity"] == 2.0
    assert row["days_cover"] == 3.0  # 6 on hand / 2 per day
    assert row["suggested_qty"] == 32  # ceil(10 + 28 - 6)


def test_forecast_route(ctx5, client, monkeypatch):
    monkeypatch.setattr(
        forecast_service, "forecast",
        lambda o, s, d: {"as_of": "2026-01-01", "window_days": d,
                         "cover_target_days": 14, "estimate": True,
                         "rows": []})
    data = _body(client, "get", "/api/v1/reports/forecast?days=7")
    assert data["window_days"] == 7


def test_transfer_service_validation(monkeypatch):
    from app.core.database import get_supabase_service  # noqa: F401
    import app.services.transfer_service as ts

    class _One:
        def __init__(self, data):
            self.data = data

    class _T:
        def __init__(self, rows):
            self._rows = rows
            self._eq = []

        def table(self, *a, **k):
            return self

        def select(self, *a, **k):
            return self

        def eq(self, *a, **k):
            return self

        def in_(self, *a, **k):
            return self

        def maybe_single(self):
            return self

        def order(self, *a, **k):
            return self

        def limit(self, *a, **k):
            return self

        def update(self, *a, **k):
            return self

        def execute(self):
            return _One(self._rows)

    # Self-transfer rejected before any DB write.
    sb = _T([])
    monkeypatch.setattr(ts, "_sb", lambda: sb)
    with pytest.raises(ValidationAppError):
        ts.create_transfer(ORG, USER, STORE_A, STORE_A,
                           [{"product_id": str(uuid.uuid4()), "quantity": 1}])
    # Unknown destination store rejected.
    sb2 = _T([])
    monkeypatch.setattr(ts, "_sb", lambda: sb2)
    with pytest.raises(NotFoundError):
        ts.create_transfer(ORG, USER, STORE_A, str(uuid.uuid4()),
                           [{"product_id": str(uuid.uuid4()), "quantity": 1}])
    # RPC error codes map to friendly errors.
    with pytest.raises(ConflictError):
        raise ts._map("INSUFFICIENT_STOCK:abc")
    with pytest.raises(NotFoundError):
        raise ts._map("TRANSFER_NOT_FOUND")
