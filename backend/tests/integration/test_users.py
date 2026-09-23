"""User management: list/add/invite/change role/remove. Service faked; routes,
gates, envelopes real."""
import uuid

import pytest

from app.api.v1 import dependencies as deps
from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.main import app
from app.services import invite_service, subscription_service, user_service

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
        "invites": [],
        "invites_resent": [],
        "invites_revoked": [],
        "accepted": [],
        "created_with_password": None,
    }

    monkeypatch.setattr(
        user_service, "list_members",
        lambda org, acting: list(state["members"]))

    def _find_auth(email):
        # missing@ / invite@ have no Supabase Auth user yet → invite path.
        if email.startswith(("missing@", "invite@")):
            return None
        return {"id": STAFF, "email": email,
                "user_metadata": {"full_name": "Staff"}}

    monkeypatch.setattr(user_service, "find_auth_user_by_email", _find_auth)
    monkeypatch.setattr(subscription_service, "check_limit", lambda *a, **k: None)

    def _add(org, email, role, store_id, acting, full_name=None, phone=None):
        if email.endswith("@other.ph"):
            raise ConflictError("That account already belongs to another business")
        row = {"id": STAFF, "full_name": full_name or "Staff", "email": email,
               "phone": phone, "status": "active", "role": role,
               "roles": [{"store_id": store_id or STORE, "role": role}],
               "is_self": False}
        state["members"].append(row)
        state["added"].append(row)
        return row

    monkeypatch.setattr(user_service, "add_member", _add)

    def _create_with_password(org, email, role, store_id, acting, password,
                              full_name=None, phone=None):
        if len(password or "") < 6:
            raise ValidationAppError("Password must be at least 6 characters")
        if not (full_name or "").strip():
            raise ValidationAppError("Full name is required")
        if store_id and store_id != STORE:
            # only MAIN exists in fixture unless caller sends STORE
            pass
        row = {"id": str(uuid.uuid4()), "full_name": (full_name or "").strip(),
               "email": email, "phone": phone, "status": "active", "role": role,
               "roles": [{"store_id": store_id or STORE, "role": role}],
               "is_self": False, "last_login": None}
        state["created_with_password"] = row
        state["members"].append(row)
        return row

    monkeypatch.setattr(
        user_service, "create_member_with_password", _create_with_password)

    def _branch_stores(org):
        return [
            {"id": STORE, "name": "Main", "code": "MAIN",
             "address": "Cebu", "status": "active", "is_hq": True},
            {"id": str(uuid.uuid4()), "name": "Annex", "code": "ANX",
             "address": "Mandaue", "status": "active", "is_hq": False},
        ]

    monkeypatch.setattr(user_service, "branch_stores", _branch_stores)

    # Route-level create: password → create; registered → attach; else invite.
    def _create_invite(org, email, role, store_id, acting,
                       full_name=None, phone=None, password=None):
        role = (role or "").strip().lower()
        if role not in invite_service.ASSIGNABLE_ROLES:
            raise ValidationAppError("Role must be owner, manager, cashier, or staff")
        if password:
            return user_service.create_member_with_password(
                org, email, role, store_id, acting, password,
                full_name=full_name, phone=phone)
        auth = user_service.find_auth_user_by_email(email)
        if auth:
            return user_service.add_member(
                org, email, role, store_id, acting,
                full_name=full_name, phone=phone)
        inv_id = str(uuid.uuid4())
        stored = {
            "id": inv_id, "email": email, "role": role, "status": "pending",
            "store_id": store_id or STORE, "organization_id": org,
            "invite_url": f"http://localhost:5173/accept-invite?token={'t' * 40}",
            "expires_at": "2099-01-01T00:00:00+00:00",
            "full_name": full_name, "phone": phone, "last_login": None,
            "is_self": False, "email_error": None,
            "roles": [{"store_id": store_id or STORE, "role": role}],
        }
        state["invites"].append(stored)
        return {**stored, "status": "invited"}

    monkeypatch.setattr(invite_service, "create_invite", _create_invite)

    def _list_invites(org, status="pending"):
        return [r for r in state["invites"]
                if status is None or r.get("status") == status]

    def _resend(org, invite_id, actor):
        for r in state["invites"]:
            if r["id"] == invite_id:
                r["invite_url"] = f"http://localhost:5173/accept-invite?token={'u' * 40}"
                state["invites_resent"].append(invite_id)
                return r
        raise NotFoundError("Invite not found")

    def _revoke(org, invite_id, actor):
        for r in state["invites"]:
            if r["id"] == invite_id:
                r["status"] = "revoked"
                state["invites_revoked"].append(invite_id)
                return {"id": invite_id, "status": "revoked"}
        raise NotFoundError("Invite not found")

    def _peek(token):
        for r in state["invites"]:
            if r["invite_url"] and token in r["invite_url"]:
                if r.get("status") == "revoked":
                    raise ConflictError("This invite was revoked")
                return {"email": r["email"], "role": r["role"],
                        "organization_id": r["organization_id"],
                        "store_id": r.get("store_id")}
        raise NotFoundError("Invite not found or already used")

    def _accept(token, user_id, email, full_name=None):
        row = _peek(token)
        if (email or "").lower() != row["email"].lower():
            raise ValidationAppError("wrong email")
        out = {"organization_id": row["organization_id"],
               "store_id": row.get("store_id"), "role": row["role"]}
        state["accepted"].append(out)
        return out

    monkeypatch.setattr(invite_service, "list_invites", _list_invites)
    monkeypatch.setattr(invite_service, "resend_invite", _resend)
    monkeypatch.setattr(invite_service, "revoke_invite", _revoke)
    monkeypatch.setattr(invite_service, "peek_invite", _peek)
    monkeypatch.setattr(invite_service, "accept_invite", _accept)

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
    assert body.get("status") != "invited"
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


def test_add_unknown_email_creates_invite(client, ctx_users):
    """No Auth user yet → pending invite, not 404."""
    r = client.post("/api/v1/users",
                    json={"email": "missing@shop.ph", "role": "cashier"})
    assert r.status_code == 201, r.text
    body = r.json()["data"]
    assert body["status"] == "invited"
    assert body["email"] == "missing@shop.ph"
    assert body["invite_url"]
    assert r.json()["message"] == "Invite sent"
    assert len(ctx_users["invites"]) == 1
    assert len(ctx_users["added"]) == 0


def test_add_other_org_409(client, ctx_users):
    r = client.post("/api/v1/users",
                    json={"email": "x@other.ph", "role": "cashier"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"


def test_list_invites(client, ctx_users):
    client.post("/api/v1/users", json={"email": "invite@shop.ph", "role": "cashier"})
    r = client.get("/api/v1/users/invites")
    assert r.status_code == 200, r.text
    rows = r.json()["data"]
    assert len(rows) == 1
    assert rows[0]["email"] == "invite@shop.ph"
    assert rows[0]["status"] == "pending"


def test_resend_invite(client, ctx_users):
    post = client.post("/api/v1/users",
                       json={"email": "invite@shop.ph", "role": "cashier"})
    inv_id = post.json()["data"]["id"]
    r = client.post(f"/api/v1/users/invites/{inv_id}/resend")
    assert r.status_code == 200, r.text
    assert inv_id in ctx_users["invites_resent"]


def test_revoke_invite(client, ctx_users):
    post = client.post("/api/v1/users",
                       json={"email": "invite@shop.ph", "role": "cashier"})
    inv_id = post.json()["data"]["id"]
    r = client.delete(f"/api/v1/users/invites/{inv_id}")
    assert r.status_code == 200, r.text
    assert inv_id in ctx_users["invites_revoked"]


def test_peek_and_accept_invite(client, ctx_users):
    post = client.post("/api/v1/users",
                       json={"email": "invite@shop.ph", "role": "cashier"})
    url = post.json()["data"]["invite_url"]
    token = url.split("token=", 1)[1]
    peek = client.get("/api/v1/users/accept", params={"token": token})
    assert peek.status_code == 200, peek.text
    assert peek.json()["data"]["email"] == "invite@shop.ph"

    async def _invitee():
        return deps.CurrentUser(
            id=uuid.uuid4(), email="invite@shop.ph",
            organization_id=None, stores=[])

    app.dependency_overrides[deps.get_current_user] = _invitee
    acc = client.post("/api/v1/users/accept", json={"token": token})
    assert acc.status_code == 200, acc.text
    assert acc.json()["data"]["role"] == "cashier"
    assert len(ctx_users["accepted"]) == 1


def test_accept_invite_requires_auth(client):
    # No fixture: real get_current_user must 401 without a bearer token.
    app.dependency_overrides.clear()
    assert client.post("/api/v1/users/accept",
                       json={"token": "x" * 40}).status_code == 401


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


def test_create_account_with_password(client, ctx_users):
    r = client.post("/api/v1/users", json={
        "email": "new@shop.ph", "role": "cashier",
        "full_name": "Juan Dela Cruz", "phone": "09171234567",
        "password": "secret12", "store_id": STORE,
    })
    assert r.status_code == 201, r.text
    body = r.json()["data"]
    assert body["status"] == "active"
    assert body["full_name"] == "Juan Dela Cruz"
    assert body["phone"] == "09171234567"
    assert not body.get("invite_url")
    assert r.json()["message"] == "Account created"
    assert ctx_users["created_with_password"]["email"] == "new@shop.ph"


def test_create_password_too_short(client, ctx_users):
    r = client.post("/api/v1/users", json={
        "email": "new@shop.ph", "role": "cashier",
        "full_name": "Juan", "password": "abc",
    })
    assert r.status_code == 422


def test_create_full_name_required_when_password(client, ctx_users):
    r = client.post("/api/v1/users", json={
        "email": "new@shop.ph", "role": "cashier",
        "full_name": "   ", "password": "secret12",
    })
    assert r.status_code == 422, r.text
    assert "Full name" in r.json()["error"]["message"]


def test_branch_stores_hq_first(client, ctx_users):
    r = client.get("/api/v1/users/branch-stores")
    assert r.status_code == 200, r.text
    rows = r.json()["data"]
    assert rows[0]["is_hq"] is True
    assert sum(1 for s in rows if s["is_hq"]) == 1
    assert rows[1]["is_hq"] is False
    assert rows[0]["address"] == "Cebu"
    assert rows[0]["status"] == "active"


def test_add_with_password_and_branch(client, ctx_users):
    r = client.post("/api/v1/users", json={
        "email": "cashier@shop.ph", "role": "cashier",
        "full_name": "Maria Santos", "store_id": STORE,
        "password": "hunter22",
    })
    assert r.status_code == 201, r.text
    assert ctx_users["created_with_password"]["full_name"] == "Maria Santos"
    assert ctx_users["created_with_password"]["roles"][0]["store_id"] == STORE
