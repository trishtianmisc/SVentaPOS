"""User management: list/add/change role/remove. Service faked; routes,
gates, envelopes real."""
import uuid

import pytest

from app.api.v1 import dependencies as deps
from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.main import app
from app.services import subscription_service, user_service

ORG = str(uuid.uuid4())
STORE = str(uuid.uuid4())
OWNER = str(uuid.uuid4())
STAFF = str(uuid.uuid4())


@pytest.fixture()
def ctx_users(client, monkeypatch):
    state = {
        "members": [
            {"id": OWNER, "full_name": "Boss", "email": "boss@shop.ph",
             "status": "active", "role": "owner",
             "roles": [{"store_id": STORE, "store_name": "Main", "role": "owner"}],
             "is_self": True},
            {"id": STAFF, "full_name": "Staff", "email": "staff@shop.ph",
             "status": "active", "role": "cashier",
             "roles": [{"store_id": STORE, "store_name": "Main", "role": "cashier"}],
             "is_self": False},
        ],
        "added": [],
        "roles_changed": [],
        "removed": [],
    }

    monkeypatch.setattr(
        user_service, "list_members",
        lambda org, acting: list(state["members"]))
    monkeypatch.setattr(
        user_service, "find_auth_user_by_email",
        lambda email: {"id": STAFF, "email": email,
                       "user_metadata": {"full_name": "Staff"}})
    monkeypatch.setattr(subscription_service, "check_limit", lambda *a, **k: None)

    def _add(org, email, role, store_id, acting):
        if email.endswith("@other.ph"):
            raise ConflictError("That account already belongs to another business")
        if email.startswith("missing@"):
            raise NotFoundError(
                "No VentaPOS account with that email — ask them to register first")
        row = {"id": STAFF, "full_name": "Staff", "email": email,
               "status": "active", "role": role,
               "roles": [{"store_id": store_id or STORE, "role": role}],
               "is_self": False}
        state["members"].append(row)
        state["added"].append(row)
        return row

    monkeypatch.setattr(user_service, "add_member", _add)

    def _role(org, uid, role, acting):
        if str(uid) == OWNER and role != "owner":
            raise ConflictError("Cannot demote the last owner")
        for m in state["members"]:
            if m["id"] == str(uid):
                m["role"] = role
                m["roles"] = [{**r, "role": role} for r in m["roles"]]
                state["roles_changed"].append((uid, role))
                return m
        raise NotFoundError("User not found in this business")

    monkeypatch.setattr(user_service, "change_role", _role)

    def _remove(org, uid, acting):
        if str(uid) == str(acting):
            raise ValidationAppError("You cannot remove your own account here")
        before = len(state["members"])
        state["members"] = [m for m in state["members"] if m["id"] != str(uid)]
        if len(state["members"]) == before:
            raise NotFoundError("User not found in this business")
        state["removed"].append(uid)

    monkeypatch.setattr(user_service, "remove_member", _remove)

    async def _owner():
        return deps.CurrentUser(
            id=uuid.UUID(OWNER), email="boss@shop.ph",
            organization_id=uuid.UUID(ORG),
            stores=[{"store_id": STORE, "role": "owner"}])

    async def _org():
        return uuid.UUID(ORG)

    async def _store():
        return {"store_id": STORE, "role": "owner"}

    app.dependency_overrides[deps.get_current_user] = _owner
    app.dependency_overrides[deps.get_current_organization] = _org
    app.dependency_overrides[deps.get_current_store] = _store
    yield state
    app.dependency_overrides.clear()


def test_list_requires_role(client, ctx_users):
    r = client.get("/api/v1/users")
    assert r.status_code == 200, r.text
    ids = {m["id"] for m in r.json()["data"]}
    assert OWNER in ids and STAFF in ids
    owner_row = next(m for m in r.json()["data"] if m["id"] == OWNER)
    assert owner_row["role"] == "owner"


def test_cashier_cannot_list(client, ctx_users):
    async def _cashier():
        return deps.CurrentUser(
            id=uuid.uuid4(), email="c@shop.ph",
            organization_id=uuid.UUID(ORG),
            stores=[{"store_id": STORE, "role": "cashier"}])

    app.dependency_overrides[deps.get_current_user] = _cashier
    r = client.get("/api/v1/users")
    assert r.status_code == 403


def test_cashier_cannot_add(client, ctx_users):
    async def _cashier():
        return deps.CurrentUser(
            id=uuid.uuid4(), email="c@shop.ph",
            organization_id=uuid.UUID(ORG),
            stores=[{"store_id": STORE, "role": "cashier"}])

    app.dependency_overrides[deps.get_current_user] = _cashier
    r = client.post("/api/v1/users", json={"email": "a@b.ph", "role": "cashier"})
    assert r.status_code == 403


def test_add_owner_ok(client, ctx_users):
    r = client.post("/api/v1/users",
                    json={"email": "new@shop.ph", "role": "manager"})
    assert r.status_code == 201, r.text
    body = r.json()["data"]
    assert body["email"] == "new@shop.ph"
    assert body["role"] == "manager"
    assert len(ctx_users["added"]) == 1


def test_add_invalid_role(client, ctx_users):
    r = client.post("/api/v1/users",
                    json={"email": "new@shop.ph", "role": "superuser"})
    assert r.status_code == 422


def test_add_staff_role_ok(client, ctx_users):
    r = client.post("/api/v1/users",
                    json={"email": "new@shop.ph", "role": "inventory"})
    assert r.status_code == 201, r.text
    assert r.json()["data"]["role"] == "inventory"


def test_add_invalid_email(client, ctx_users):
    r = client.post("/api/v1/users", json={"email": "not-an-email", "role": "cashier"})
    assert r.status_code == 422


def test_add_unknown_email_404(client, ctx_users):
    r = client.post("/api/v1/users",
                    json={"email": "missing@shop.ph", "role": "cashier"})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


def test_add_other_org_409(client, ctx_users):
    r = client.post("/api/v1/users",
                    json={"email": "x@other.ph", "role": "cashier"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"


def test_change_role_ok(client, ctx_users):
    r = client.patch(f"/api/v1/users/{STAFF}", json={"role": "manager"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["role"] == "manager"


def test_change_role_invalid(client, ctx_users):
    r = client.patch(f"/api/v1/users/{STAFF}", json={"role": "superuser"})
    assert r.status_code == 422


def test_cannot_demote_last_owner(client, ctx_users):
    r = client.patch(f"/api/v1/users/{OWNER}", json={"role": "cashier"})
    assert r.status_code == 409


def test_remove_ok(client, ctx_users):
    r = client.delete(f"/api/v1/users/{STAFF}")
    assert r.status_code == 200, r.text
    assert STAFF in ctx_users["removed"]


def test_cannot_remove_self(client, ctx_users):
    r = client.delete(f"/api/v1/users/{OWNER}")
    assert r.status_code == 422


def test_requires_auth(client):
    assert client.get("/api/v1/users").status_code == 401
    assert client.post("/api/v1/users",
                       json={"email": "a@b.ph"}).status_code == 401
