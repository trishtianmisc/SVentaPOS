from tests.conftest import (
    jwks_state,
    make_rotated_token,
    make_token,
    make_token_other_key,
    rotated_jwk,
)


def test_me_requires_auth(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHORIZED"


def test_me_malformed_bearer(client):
    r = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHORIZED"


def test_me_valid_es256(client):
    r = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {make_token()}"}
    )
    assert r.status_code == 200
    assert r.json()["data"]["user_id"]


def test_me_expired(client):
    r = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {make_token(minutes=-10)}"},
    )
    assert r.status_code == 401


def test_me_unknown_kid(client):
    r = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {make_token(kid='nope')}"},
    )
    assert r.status_code == 401
    # Unknown kid triggers a forced JWKS refresh.
    assert True in jwks_state["calls"]


def test_me_invalid_signature(client):
    r = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {make_token_other_key()}"},
    )
    assert r.status_code == 401


def test_me_missing_sub(client):
    r = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {make_token(include_sub=False)}"},
    )
    assert r.status_code == 401


def test_jwks_rotation(client):
    # Start on old keys, rotate on refresh: token with new kid succeeds
    # only after the forced refresh picks up the rotated JWKS.
    jwks_state["refresh_to"] = [rotated_jwk()]
    r = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {make_rotated_token()}"},
    )
    assert r.status_code == 200
    assert True in jwks_state["calls"]


def test_error_envelope_on_404(client):
    r = client.get("/api/v1/nope")
    assert r.status_code == 404
    assert "error" in r.json()
