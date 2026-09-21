"""Onboarding: self-serve account+store bootstrap. Service faked; routes,
//auth gating, envelopes, and validation are real."""
import uuid

import pytest

from app.api.v1 import dependencies as deps
from app.core.exceptions import ConflictError, ValidationAppError
from app.main import app
from app.services import organization_service

ORG = str(uuid.uuid4())
STORE = str(uuid.uuid4())
USER = str(uuid.uuid4())


@pytest.fixture()
def ctxob(client, monkeypatch):
    async def _user():
        return deps.CurrentUser(id=uuid.UUID(USER), email="new@shop.ph")

    app.dependency_overrides[deps.get_current_user] = _user
    yield
    app.dependency_overrides.clear()


def test_bootstrap_success(client, ctxob, monkeypatch):
    payload = {"organization": {"id": ORG, "name": "Shop",
                                "slug": "shop", "status": "active"},
               "store": {"id": STORE, "name": "Main"}}
    monkeypatch.setattr(organization_service, "bootstrap",
                        lambda *a, **k: payload)
    r = client.post("/api/v1/organizations",
                    json={"name": "Shop", "store_name": "Main"})
    assert r.status_code == 201, r.text
    assert r.json()["data"]["organization"]["id"] == ORG
    assert r.json()["data"]["store"]["id"] == STORE


def test_bootstrap_rejects_second_org(client, ctxob, monkeypatch):
    def _boom(*a, **k):
        raise ConflictError("Account already belongs to an organization")

    monkeypatch.setattr(organization_service, "bootstrap", _boom)
    r = client.post("/api/v1/organizations",
                    json={"name": "Other", "store_name": "Main"})
    assert r.status_code == 409


def test_bootstrap_validation(client, ctxob):
    r = client.post("/api/v1/organizations",
                    json={"name": "", "store_name": ""})
    assert r.status_code == 422


def test_bootstrap_requires_auth(client):
    r = client.post("/api/v1/organizations",
                    json={"name": "Shop", "store_name": "Main"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHORIZED"


def test_slugify():
    assert organization_service.slugify("Aling Nena's Store!") == "aling-nena-s-store"
    try:
        organization_service.slugify("!!!")
    except ValidationAppError:
        pass
    else:
        raise AssertionError("expected ValidationAppError")
