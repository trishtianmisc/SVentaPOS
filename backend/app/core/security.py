"""Supabase JWT verification via JWKS (signing keys).

Identity provider = Supabase Auth.
- Extracts Bearer token.
- Reads unverified header only for kid/alg.
- Fetches {SUPABASE_URL}/auth/v1/.well-known/jwks.json with TTL cache.
- Verifies ES256 (current) + RS256 (future-compatible).
- Validates expiration, requires sub.
- Profile/org/store resolution happens in api dependencies.
- App JWT_SECRET is never used here.
"""
import threading
import time

import httpx
import jwt
import structlog
from jwt import PyJWK

from app.core.config import settings
from app.core.exceptions import UnauthorizedError

log = structlog.get_logger("ventapos.auth")

_ALLOWED_ALGS = ("ES256", "RS256")

_jwks_cache: dict = {"keys": [], "fetched_at": 0.0}
# Single-flight: concurrent cold requests share one network fetch instead of
# each doing its own. Double-checked inside the lock.
_jwks_lock = threading.Lock()


def _cache_fresh() -> bool:
    return bool(_jwks_cache["keys"]) and (
        time.monotonic() - _jwks_cache["fetched_at"]
        < settings.jwks_cache_ttl_seconds
    )


def _fetch_jwks(force: bool = False) -> list[dict]:
    if not force and _cache_fresh():
        return _jwks_cache["keys"]
    with _jwks_lock:
        if not force and _cache_fresh():
            return _jwks_cache["keys"]
        try:
            # Fetch signing keys; cache locally so rotation
            # (unknown kid -> refresh once) is explicit.
            data = httpx.get(
                settings.jwks_url, timeout=settings.jwks_timeout_seconds
            ).json()
            keys = data.get("keys", [])
        except Exception:
            # Network failure with warm cache: keep serving cached keys.
            if _jwks_cache["keys"]:
                return _jwks_cache["keys"]
            raise UnauthorizedError("Invalid or expired token")
        _jwks_cache["keys"] = keys
        _jwks_cache["fetched_at"] = time.monotonic()
        return keys


def _key_for_kid(kid: str) -> PyJWK:
    keys = _fetch_jwks()
    match = next((k for k in keys if k.get("kid") == kid), None)
    if match is None:
        # Rotation: refresh once, then give up.
        keys = _fetch_jwks(force=True)
        match = next((k for k in keys if k.get("kid") == kid), None)
    if match is None:
        raise UnauthorizedError("Invalid or expired token")
    try:
        return PyJWK(match)
    except Exception:
        raise UnauthorizedError("Invalid or expired token")


def _clear_jwks_cache() -> None:
    _jwks_cache["keys"] = []
    _jwks_cache["fetched_at"] = 0.0


def decode_bearer_token(authorization: str | None) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise UnauthorizedError("Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise UnauthorizedError("Missing bearer token")
    if not settings.supabase_url:
        raise UnauthorizedError("Invalid or expired token")
    try:
        header = jwt.get_unverified_header(token)
    except Exception:
        raise UnauthorizedError("Invalid or expired token")
    kid = header.get("kid")
    alg = header.get("alg")
    if not kid or alg not in _ALLOWED_ALGS:
        raise UnauthorizedError("Invalid or expired token")
    try:
        key = _key_for_kid(kid)
        claims = jwt.decode(
            token,
            key.key,
            algorithms=[alg],
            options={"verify_aud": False},
            leeway=30,
        )
    except Exception as e:
        log.info("token_rejected", kid=kid, alg=alg, reason=type(e).__name__)
        raise UnauthorizedError("Invalid or expired token")
    if "sub" not in claims:
        raise UnauthorizedError("Invalid token claims")
    return claims
