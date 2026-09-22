"""Phase 7 billing: effective-plan fallback, feature gates, period stamps,
manual upgrade flow (request/approve/decline, self-serve downgrade).
Service fakes in-memory; routes, gates, envelopes are real. The wholesale
tier gate itself lives in complete_sale (migration 0018, verified live)."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.api.v1 import dependencies as deps
from app.api.v1.routes import admin as admin_routes
from app.main import app
from app.services import (
    audit_service,
    notification_service,
    report_service,
    subscription_service,
)

ORG = str(uuid.uuid4())
STORE = str(uuid.uuid4())
USER = str(uuid.uuid4())
ADMIN_EMAIL = "ops@ventapos.ph"

FREE = {"id": str(uuid.uuid4()), "name": "Free", "price": 0,
        "billing_interval": "monthly", "active": True,
        "feature_limits": {"max_stores": 1, "max_products": 50,
                           "max_users": 1, "advanced_reports": False,
                           "wholesale": False}}
PRO = {"id": str(uuid.uuid4()), "name": "Pro", "price": 2999,
       "billing_interval": "monthly", "active": True,
       "feature_limits": {"max_stores": 10, "max_products": 100000,
                          "max_users": 50, "advanced_reports": True,
                          "wholesale": True}}


def _sub(plan, status="active", period_end=None, request=None):
    return {"id": str(uuid.uuid4()), "organization_id": ORG,
            "plan_id": plan["id"], "status": status, "provider": "manual",
            "plan": dict(plan), "subscription_plans": dict(plan),
            "current_period_end": period_end,
            "upgrade_request": request}


class _R:
    def __init__(self, data):
        self.data = data


class _Fake:
    def __init__(self, state):
        self.s = state
        self._row = None
        self._eq: list[tuple] = []
        self._single = False

    def table(self, name):
        self._table = name
        self._eq = []
        self._single = False
        return self

    def select(self, *a, **k):
        self._sel = a[0] if a else ""
        return self

    def eq(self, col, val):
        self._eq.append((col, val))
        return self

    def order(self, *a, **k):
        return self

    def limit(self, *a, **k):
        return self

    def maybe_single(self):
        self._single = True
        return self

    def _filtered(self, rows):
        for col, val in self._eq:
            rows = [r for r in rows if r.get(col) == val]
        return rows

    def upsert(self, row, on_conflict=None):
        subs = self.s["subs"]
        plan = next((p for p in (FREE, PRO)
                     if p["id"] == row.get("plan_id")), {})
        for i, r in enumerate(subs):
            if r["organization_id"] == row["organization_id"]:
                subs[i] = {**r, **row, "subscription_plans": dict(plan)}
                self._staged = [subs[i]]
                return self
        new = {"id": str(uuid.uuid4()), **row,
               "subscription_plans": dict(plan)}
        subs.append(new)
        self._staged = [new]
        return self

    def update(self, patch):
        self._patch = patch
        return self

    def execute(self):
        if getattr(self, "_staged", None) is not None:
            out, self._staged = self._staged, None
            return _R(out)
        if getattr(self, "_patch", None) is not None:
            rows = [r for r in self.s["subs"]
                    if r["organization_id"] == ORG]
            for r in rows:
                r.update(self._patch)
            out, self._patch = rows, None
            return _R(out)
        if self._table == "subscription_plans":
            rows = self._filtered([FREE, PRO])
            return _R(rows[0] if (self._single and rows) else rows)
        if self._table == "subscriptions":
            rows = [r for r in self.s["subs"]
                    if r["organization_id"] == ORG]
            if "organizations(name)" in str(getattr(self, "_sel", "")):
                rows = [{**r, "organizations": {"name": "Shop"}} for r in rows]
            if self._single:
                return _R(rows[0] if rows else None)
            return _R(rows)
        return _R([])


@pytest.fixture()
def ctx7(client, monkeypatch):
    state = {"subs": [_sub(FREE)], "audit": [], "notifs": [],
             "role": "owner", "admin": False}
    fake = _Fake(state)
    # subscription_service._sb is real-shaped; fake at table level.
    monkeypatch.setattr(subscription_service, "_sb", lambda: fake)
    monkeypatch.setattr(admin_routes, "get_supabase_service", lambda: fake)
    monkeypatch.setattr(
        audit_service, "record",
        lambda o, a, e, i="", **k: state["audit"].append(
            {"action": a, "entity_id": i, **k}))
    monkeypatch.setattr(
        notification_service, "notify",
        lambda o, t, title, body="", **k: state["notifs"].append(
            {"type": t, "title": title}))

    async def _user():
        if state["admin"]:
            return deps.CurrentUser(id=uuid.uuid4(), email=ADMIN_EMAIL)
        return deps.CurrentUser(
            id=uuid.UUID(USER), email="o@shop.ph",
            organization_id=uuid.UUID(ORG),
            stores=[{"store_id": STORE, "role": state["role"]}])

    async def _org():
        return uuid.UUID(ORG)

    async def _store():
        return {"store_id": STORE, "role": state["role"]}

    app.dependency_overrides[deps.get_current_user] = _user
    app.dependency_overrides[deps.get_current_organization] = _org
    app.dependency_overrides[deps.get_current_store] = _store
    from app.core.config import settings

    monkeypatch.setattr(settings, "platform_admin_emails", ADMIN_EMAIL)
    yield state
    app.dependency_overrides.clear()


def _ok(client, method, path, **kw):
    r = getattr(client, method)(path, **kw)
    assert r.status_code in (200, 201), r.text
    return r.json()["data"]


def test_free_fallback_when_canceled(ctx7):
    ctx7["subs"] = [_sub(PRO, status="canceled")]
    cur = subscription_service.current(ORG)
    assert cur["effective_plan"] == "Free"
    assert cur["downgraded"] == "canceled"
    assert cur["plan"]["name"] == "Free"
    assert cur["raw_plan"]["name"] == "Pro"


def test_free_fallback_when_period_expired(ctx7):
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    ctx7["subs"] = [_sub(PRO, period_end=past)]
    cur = subscription_service.current(ORG)
    assert cur["effective_plan"] == "Free"
    assert cur["downgraded"] == "expired"


def test_active_paid_plan_not_downgraded(ctx7):
    future = (datetime.now(timezone.utc) + timedelta(days=9)).isoformat()
    ctx7["subs"] = [_sub(PRO, period_end=future)]
    cur = subscription_service.current(ORG)
    assert cur["effective_plan"] == "Pro"
    assert cur["downgraded"] is None


def test_require_feature_gate(ctx7):
    from app.core.exceptions import ForbiddenError

    with pytest.raises(ForbiddenError):
        subscription_service.require_feature(ORG, "wholesale")
    ctx7["subs"] = [_sub(PRO)]
    subscription_service.require_feature(ORG, "wholesale")  # Pro: passes
    subscription_service.require_feature(ORG, "advanced_reports")


def test_set_plan_stamps_period(ctx7, monkeypatch):
    real_upsert_rows = []

    orig = subscription_service._sb

    class _Cap(_Fake):
        def upsert(self, row, on_conflict=None):
            real_upsert_rows.append(row)
            return super().upsert(row, on_conflict)

    monkeypatch.setattr(subscription_service, "_sb", lambda: _Cap(ctx7))
    subscription_service.set_plan(ORG, "Pro")
    row = real_upsert_rows[0]
    start = datetime.fromisoformat(row["current_period_start"])
    end = datetime.fromisoformat(row["current_period_end"])
    assert (end - start).days == 30


def test_consolidated_gated_on_free(ctx7, client, monkeypatch):
    monkeypatch.setattr(report_service, "consolidated_sales",
                        lambda *a, **k: {"total": 1})
    r = client.get("/api/v1/reports/consolidated/sales")
    assert r.status_code == 403
    assert "upgrade" in r.json()["error"]["message"].lower()
    # Basic per-store report stays open.
    monkeypatch.setattr(report_service, "sales", lambda *a, **k: {"total": 1})
    r = client.get("/api/v1/reports/sales")
    assert r.status_code == 200


def test_consolidated_open_on_pro(ctx7, client, monkeypatch):
    ctx7["subs"] = [_sub(PRO)]
    monkeypatch.setattr(report_service, "consolidated_sales",
                        lambda *a, **k: {"total": 1})
    r = client.get("/api/v1/reports/consolidated/sales")
    assert r.status_code == 200


def test_upgrade_request_flow(ctx7, client):
    got = _ok(client, "post", "/api/v1/subscriptions/request-upgrade",
              json={"plan": "Pro", "note": "need stores"})
    assert got["upgrade_request"]["plan"] == "Pro"
    assert any(a["action"] == "subscription.upgrade_request"
               for a in ctx7["audit"])
    # Free needs no approval.
    r = client.post("/api/v1/subscriptions/request-upgrade",
                    json={"plan": "Free"})
    assert r.status_code == 422
    # Cashier cannot request.
    ctx7["role"] = "cashier"
    r = client.post("/api/v1/subscriptions/request-upgrade",
                    json={"plan": "Pro"})
    assert r.status_code == 403
    ctx7["role"] = "owner"


def test_admin_approve_and_decline(ctx7, client):
    _ok(client, "post", "/api/v1/subscriptions/request-upgrade",
        json={"plan": "Pro"})
    ctx7["admin"] = True
    reqs = _ok(client, "get", "/api/v1/admin/upgrade-requests")
    assert len(reqs) == 1 and reqs[0]["request"]["plan"] == "Pro"
    # Approve applies the plan and clears the request.
    _ok(client, "post", f"/api/v1/admin/organizations/{ORG}/subscription",
        json={"plan": "Pro"})
    assert _ok(client, "get", "/api/v1/admin/upgrade-requests") == []
    # New request, then decline.
    ctx7["admin"] = False
    _ok(client, "post", "/api/v1/subscriptions/request-upgrade",
        json={"plan": "Pro"})
    ctx7["admin"] = True
    _ok(client, "post", f"/api/v1/admin/upgrade-requests/{ORG}/decline")
    assert _ok(client, "get", "/api/v1/admin/upgrade-requests") == []
    assert any(a["action"] == "subscription.upgrade_declined"
               for a in ctx7["audit"])


def test_self_serve_downgrade(ctx7, client):
    ctx7["subs"] = [_sub(PRO)]
    got = _ok(client, "post", "/api/v1/subscriptions/downgrade")
    assert got["plan"]["name"] == "Free"
    assert got["effective_plan"] == "Free"
    assert any(a["action"] == "subscription.downgrade"
               for a in ctx7["audit"])
