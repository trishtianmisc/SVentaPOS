"""Pytest fixtures: TestClient + ephemeral ES256 JWKS (no real secrets)."""
import base64
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.testclient import TestClient

import app.core.security as security
from app.core.config import settings
from app.main import app

TEST_KID = "test-kid-1"
ROTATED_KID = "test-kid-2"


def _b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _make_ec_keypair():
    from cryptography.hazmat.primitives.asymmetric import ec

    priv = ec.generate_private_key(ec.SECP256R1())
    pub = priv.public_key().public_numbers()
    x = _b64u(pub.x.to_bytes(32, "big"))
    y = _b64u(pub.y.to_bytes(32, "big"))
    jwk = {
        "kty": "EC",
        "crv": "P-256",
        "alg": "ES256",
        "use": "sig",
        "kid": TEST_KID,
        "x": x,
        "y": y,
    }
    return priv, jwk


_PRIV, _JWK = _make_ec_keypair()
_OTHER_PRIV, _OTHER_JWK = _make_ec_keypair()
_OTHER_JWK["kid"] = "other-kid"

_ROT_PRIV, _ROT_JWK = _make_ec_keypair()
_ROT_JWK["kid"] = ROTATED_KID

jwks_state = {"keys": [_JWK], "refresh_to": None, "calls": []}


def _fake_fetch_jwks(force: bool = False):
    jwks_state["calls"].append(force)
    if force and jwks_state["refresh_to"] is not None:
        jwks_state["keys"] = jwks_state["refresh_to"]
    return jwks_state["keys"]


@pytest.fixture()
def client(monkeypatch):
    settings.supabase_url = "https://test.supabase.co"
    settings.env = "development"
    # Keep app JWT untouched; security must not read it.
    settings.jwt_secret = "app-secret-untouched"
    jwks_state["keys"] = [_JWK]
    jwks_state["refresh_to"] = None
    jwks_state["calls"] = []
    monkeypatch.setattr(security, "_fetch_jwks", _fake_fetch_jwks)
    monkeypatch.setattr(security, "_clear_jwks_cache", lambda: None)
    with TestClient(app) as c:
        yield c


def _sign(payload: dict, priv, kid: str) -> str:
    from cryptography.hazmat.primitives import serialization

    pem = priv.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    return jwt.encode(payload, pem, algorithm="ES256", headers={"kid": kid})


def make_token(
    user_id: str | None = None,
    email: str = "test@example.com",
    kid: str = TEST_KID,
    minutes: int = 60,
    include_sub: bool = True,
    priv=None,
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict = {
        "email": email,
        "iat": now,
        "exp": now + timedelta(minutes=minutes),
    }
    if include_sub:
        payload["sub"] = user_id or str(uuid.uuid4())
    return _sign(payload, priv or _PRIV, kid)


def make_token_other_key(**kwargs) -> str:
    return make_token(priv=_OTHER_PRIV, **kwargs)


def make_rotated_token(**kwargs) -> str:
    kwargs.setdefault("kid", ROTATED_KID)
    return make_token(priv=_ROT_PRIV, **kwargs)


def rotated_jwk():
    return _ROT_JWK
