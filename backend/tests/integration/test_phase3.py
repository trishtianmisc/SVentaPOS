"""Phase 3: plans/limits, webhooks, platform admin, audit, notifications,
store creation. Service layer faked; routes, gates, envelopes are real."""
import hashlib
import hmac
import json
import uuid

import pytest

from app.api.v1 import dependencies as deps
from app.core.config import settings
from app.main import app
from app.services import (
    audit_service,
    notification_service,
    product_service,
    subscription_service,
)

ORG = str(uuid.uuid4())
STORE = str(uuid.uuid4())
USER = str(uuid.uuid4())
ADMIN_EMAIL = "ops@ventapos.ph"


@pytest.fixture()
def ctx3(client, monkeypatch):
    state = {
        "plans": [
            {"id": str(uuid.uuid4()), "name": "Free", "price": 0,
             "billing_interval": "monthly",
             "feature_limits": {"max_stores": 1, "max_products": 2,
                                "max_users": 1},
             "active": True},
            {"id": str(uuid.uuid4()), "name": "Business", "price": 1499,
             "billing_interval": "monthly",
             "feature_limits": {"max_stores": 3, "max_products": 5000,
                                "max_users": 15},
             "active": True},
        ],
        "sub": None,
        "usage": {"stores": 1, "products": 2, "users": 1},
        "audit": [],
        "notifs": [],
        "seen_events": set(),
    }
    state["sub"] = {"organization_id": ORG,
                    "plan_id": state["plans"][0]["id"],
                    "status": "active", "provider": "manual",
                    "plan": state["plans"][0],
                    "limits": state["plans"][0]["feature_limits"]}

    async def _user():
        return deps.CurrentUser(id=uuid.UUID(USER), email="owner@shop.ph",
                                organization_id=uuid.UUID(ORG),
                                stores=[{"store_id": STORE, "role": "owner"}])

    async def _org():
        return uuid.UUID(ORG)

    async def _store():
        return {"store_id": STORE, "role": "owner"}

    app.dependency_overrides[deps.get_current_user] = _user
    app.dependency_overrides[deps.get_current_organization] = _org
    app.dependency_overrides[deps.get_current_store] = _store
    monkeypatch.setattr(settings, "platform_admin_emails", ADMIN_EMAIL)
    monkeypatch.setattr(settings, "billing_webhook_secret", "wh-secret")
    monkeypatch.setattr(settings, "billing_provider", "testpay")

    monkeypatch.setattr(subscription_service, "list_plans", lambda: state["plans"])
    monkeypatch.setattr(subscription_service, "current", lambda o: state["sub"])
    monkeypatch.setattr(subscription_service, "usage", lambda o: state["usage"])

    from app.core.exceptions import ForbiddenError

    def _check(org, resource):
        key = {"stores": "max_stores", "products": "max_products",
               "users": "max_users"}[resource]
        if state["usage"][resource] >= state["sub"]["limits"][key]:
            raise ForbiddenError("Plan limit reached")

    monkeypatch.setattr(subscription_service, "check_limit", _check)
    monkeypatch.setattr(subscription_service, "organization_exists", lambda o: True)
    monkeypatch.setattr(
        subscription_service, "set_plan",
        lambda o, p, provider="manual", status="active": state["sub"].update(
            {"plan": next(x for x in state["plans"] if x["name"] == p),
             "status": status, "provider": provider}) or state["sub"])
    monkeypatch.setattr(
        audit_service, "record",
        lambda o, a, e, i="", **k: state["audit"].append(
            {"action": a, "entity_type": e, "entity_id": i, **k}))
    monkeypatch.setattr(audit_service, "list_logs", lambda o, limit=100: state["audit"])
    monkeypatch.setattr(
        notification_service, "notify",
        lambda o, t, title, body="", **k: state["notifs"].append(
            {"type": t, "title": title}))
    monkeypatch.setattr(notification_service, "list_notifications",
                        lambda o, u=False: state["notifs"])
    monkeypatch.setattr(product_service, "create_product",
                        lambda o, d: {"id": str(uuid.uuid4()), **d,
                                      "organization_id": o, "active": True,
                                      "retail_price": d.get("retail_price", 0)})
    yield state
    app.dependency_overrides.clear()


def _sign(body: bytes) -> str:
    return hmac.new(b"wh-secret", body, hashlib.sha256).hexdigest()


def test_plans_current_usage(client, ctx3):
    assert len(client.get("/api/v1/subscriptions/plans").json()["data"]) == 2
    cur = client.get("/api/v1/subscriptions/current").json()["data"]
    assert cur["plan"]["name"] == "Free"
    assert client.get("/api/v1/subscriptions/usage").json()["data"]["products"] == 2


def test_product_limit_enforced(client, ctx3):
    # Free allows 2 products, usage already at 2.
    r = client.post("/api/v1/products", json={"name": "Over", "retail_price": 1})
    assert r.status_code == 403
    assert "limit" in r.json()["error"]["message"].lower()


def test_webhook_happy_path_and_replay(client, ctx3):
    payload = {"event_id": "evt-1", "organization_id": ORG,
               "plan": "Business", "status": "active"}
    raw = json.dumps(payload).encode()
    r = client.post("/api/v1/webhooks/billing", content=raw,
                    headers={"X-Signature": _sign(raw),
                             "Content-Type": "application/json"})
    assert r.status_code == 200, r.text
    assert ctx3["sub"]["plan"]["name"] == "Business"
    assert any(a["action"] == "subscription.webhook" for a in ctx3["audit"])
    assert any(n["type"] == "billing" for n in ctx3["notifs"])
    # Replay acked without side effects.
    r2 = client.post("/api/v1/webhooks/billing", content=raw,
                     headers={"X-Signature": _sign(raw),
                              "Content-Type": "application/json"})
    assert r2.json()["data"].get("replayed") is True


def test_webhook_bad_signature(client, ctx3):
    raw = json.dumps({"event_id": "e", "organization_id": ORG,
                      "plan": "Business", "status": "active"}).encode()
    r = client.post("/api/v1/webhooks/billing", content=raw,
                    headers={"X-Signature": "wrong",
                             "Content-Type": "application/json"})
    assert r.status_code == 403


class _Chain:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *a, **k):
        return self

    def order(self, *a, **k):
        return self

    def limit(self, *a):
        return self

    def eq(self, *a):
        return self

    def execute(self):
        class R:
            data = self._rows
        return R()


def test_admin_gate_and_set_plan(client, ctx3, monkeypatch):
    # Non-admin blocked.
    r = client.get("/api/v1/admin/organizations")
    assert r.status_code == 403
    # Admin allowed.
    async def _admin():
        return deps.CurrentUser(id=uuid.uuid4(), email=ADMIN_EMAIL)

    app.dependency_overrides[deps.get_current_user] = _admin
    import app.api.v1.routes.admin as admin_mod

    monkeypatch.setattr(
        admin_mod, "get_supabase_service",
        lambda: __import__("types").SimpleNamespace(
            table=lambda name: _Chain(
                [{"id": ORG, "name": "Shop", "created_at": "now"}]
                if name == "organizations" else [])))
    r = client.get("/api/v1/admin/organizations")
    assert r.status_code == 200, r.text
    assert r.json()["data"][0]["plan"] == "Free"
    # Set plan works + audited.
    r = client.post(f"/api/v1/admin/organizations/{ORG}/subscription",
                    json={"plan": "Business"})
    assert r.status_code == 200, r.text
    assert any(a["action"] == "subscription.change" for a in ctx3["audit"])


def test_audit_and_notifications(client, ctx3):
    r = client.get("/api/v1/audit")
    assert r.status_code == 200
    r = client.get("/api/v1/notifications")
    assert r.status_code == 200
    assert isinstance(r.json()["data"], list)


def test_health_has_version(client):
    body = client.get("/health").json()
    assert body["status"] == "ok" and "version" in body
