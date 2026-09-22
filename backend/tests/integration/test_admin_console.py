"""Standalone admin console: platform metrics + organization detail.
Service tables faked in-memory; routes, allowlist gate, envelopes are real."""
import uuid

import pytest

from app.api.v1 import dependencies as deps
from app.api.v1.routes import admin as admin_routes
from app.core.config import settings
from app.main import app
from app.services import audit_service, subscription_service

ORG = str(uuid.uuid4())
ORG2 = str(uuid.uuid4())
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


class _R:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class _Fake:
    def __init__(self, tables):
        self.t = tables
        self._table = ""
        self._sel = ""
        self._eq: list[tuple] = []
        self._gte: list[tuple] = []
        self._single = False
        self._count_mode = None
        self._order_col = None
        self._order_desc = False
        self._limit_n = None

    def table(self, name):
        self._table = name
        self._sel = ""
        self._eq = []
        self._gte = []
        self._single = False
        self._count_mode = None
        self._order_col = None
        self._order_desc = False
        self._limit_n = None
        return self

    def select(self, cols="", count=None, **k):
        self._sel = cols or ""
        self._count_mode = count
        return self

    def eq(self, col, val):
        self._eq.append((col, val))
        return self

    def gte(self, col, val):
        self._gte.append((col, val))
        return self

    def order(self, col=None, desc=False, **k):
        self._order_col = col
        self._order_desc = desc
        return self

    def limit(self, n):
        self._limit_n = n
        return self

    def maybe_single(self):
        self._single = True
        return self

    def execute(self):
        rows = list(self.t.get(self._table, []))
        for col, val in self._eq:
            rows = [r for r in rows if r.get(col) == val]
        for col, val in self._gte:
            rows = [r for r in rows if (r.get(col) or "") >= val]
        if self._table == "subscriptions" and "subscription_plans" in self._sel:
            by_id = {p["id"]: p for p in self.t.get("subscription_plans", [])}
            rows = [{**r, "subscription_plans": dict(by_id.get(r.get("plan_id"), {}))}
                    for r in rows]
        if self._order_col:
            rows = sorted(rows, key=lambda r: r.get(self._order_col) or "",
                          reverse=self._order_desc)
        if self._limit_n is not None:
            rows = rows[: self._limit_n]
        n = len(rows)
        if self._single:
            data = rows[0] if rows else None
            return _R(data, count=n)
        return _R(rows, count=n if self._count_mode else None)


@pytest.fixture()
def ctx_admin(client, monkeypatch):
    tables = {
        "organizations": [
            {"id": ORG, "name": "Shop One", "slug": "shop-one",
             "status": "active", "created_at": "2026-09-01T00:00:00+00:00"},
            {"id": ORG2, "name": "Shop Two", "slug": "shop-two",
             "status": "suspended", "created_at": "2020-01-01T00:00:00+00:00"},
        ],
        "subscription_plans": [FREE, PRO],
        "subscriptions": [{
            "id": str(uuid.uuid4()), "organization_id": ORG,
            "plan_id": PRO["id"], "status": "active", "provider": "manual",
            "current_period_end": "2099-01-01T00:00:00+00:00",
            "upgrade_request": {"plan": "Pro", "note": "need stores"},
        }],
        "stores": [
            {"id": STORE, "organization_id": ORG, "name": "Main",
             "code": "MAIN", "status": "active",
             "created_at": "2026-09-01T00:00:00+00:00"},
        ],
        "products": [
            {"id": str(uuid.uuid4()), "organization_id": ORG, "name": "Rice"},
        ],
        "profiles": [
            {"id": USER, "organization_id": ORG, "full_name": "Owner",
             "phone": None, "status": "active",
             "created_at": "2026-09-01T00:00:00+00:00"},
        ],
        "audit_logs": [{
            "id": str(uuid.uuid4()), "organization_id": ORG,
            "store_id": None, "user_id": USER, "action": "sale.complete",
            "entity_type": "sale", "entity_id": "s1", "metadata": {},
            "created_at": "2026-09-10T00:00:00+00:00",
        }],
    }
    fake = _Fake(tables)
    monkeypatch.setattr(admin_routes, "get_supabase_service", lambda: fake)
    monkeypatch.setattr(subscription_service, "_sb", lambda: fake)
    monkeypatch.setattr(audit_service, "_sb", lambda: fake)

    async def _admin():
        return deps.CurrentUser(id=uuid.uuid4(), email=ADMIN_EMAIL)

    app.dependency_overrides[deps.get_current_user] = _admin
    monkeypatch.setattr(settings, "platform_admin_emails", ADMIN_EMAIL)
    yield {"tables": tables, "admin": True}
    app.dependency_overrides.clear()


def test_metrics_gate_and_payload(ctx_admin, client):
    # Non-admin blocked.
    async def _user():
        return deps.CurrentUser(id=uuid.uuid4(), email="o@shop.ph",
                                organization_id=uuid.UUID(ORG), stores=[])

    app.dependency_overrides[deps.get_current_user] = _user
    assert client.get("/api/v1/admin/metrics").status_code == 403

    async def _admin():
        return deps.CurrentUser(id=uuid.uuid4(), email=ADMIN_EMAIL)

    app.dependency_overrides[deps.get_current_user] = _admin
    r = client.get("/api/v1/admin/metrics")
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["organizations"]["total"] == 2
    assert data["organizations"]["active"] == 1
    assert data["organizations"]["suspended"] == 1
    assert data["totals"] == {"stores": 1, "products": 1, "users": 1}
    assert data["plans"] == {"Pro": 1}
    assert data["pending_upgrade_requests"] == 1


def test_org_detail_happy_path(ctx_admin, client):
    r = client.get(f"/api/v1/admin/organizations/{ORG}")
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["organization"]["name"] == "Shop One"
    assert data["subscription"]["plan"] == "Pro"
    assert data["subscription"]["upgrade_request"]["plan"] == "Pro"
    assert data["usage"] == {"stores": 1, "products": 1, "users": 1}
    assert data["stores"][0]["name"] == "Main"
    assert data["members"][0]["full_name"] == "Owner"
    assert data["audit_logs"][0]["action"] == "sale.complete"


def test_org_detail_missing_404(ctx_admin, client):
    r = client.get(f"/api/v1/admin/organizations/{uuid.uuid4()}")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"
