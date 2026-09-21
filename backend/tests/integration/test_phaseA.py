"""Phase A perf tests: JWKS single-flight + rotation, user-context cache.

No network, no real secrets. Fake JWKS HTTP layer and fake Supabase client.
"""
import threading
import time
from types import SimpleNamespace

import pytest

import app.core.security as security
from app.api.v1 import dependencies as deps
from app.core.config import settings
from tests.conftest import _JWK

NEW_KID = "rotated-kid-9"
NEW_JWK = {**_JWK, "kid": NEW_KID}


class _Resp:
    def __init__(self, payload):
        self._payload = payload

    def json(self):
        return self._payload


def _http_stub(keys_by_call, delay=0.05):
    calls = {"n": 0, "lock": threading.Lock()}

    def fake_get(*a, **k):
        with calls["lock"]:
            calls["n"] += 1
            n = calls["n"]
        time.sleep(delay)
        keys = keys_by_call(n)
        return _Resp({"keys": keys})

    fake_get.calls = calls
    return fake_get


@pytest.fixture(autouse=True)
def clean():
    security._clear_jwks_cache()
    with deps._user_context_lock:
        deps._user_context_cache.clear()
    yield
    security._clear_jwks_cache()
    with deps._user_context_lock:
        deps._user_context_cache.clear()


def _patch_http(monkeypatch, keys_by_call):
    fake = _http_stub(keys_by_call)
    monkeypatch.setattr(security, "httpx", SimpleNamespace(get=fake))
    return fake


def test_jwks_concurrent_single_fetch(monkeypatch):
    fake = _patch_http(monkeypatch, lambda n: [_JWK])
    with deps._user_context_lock:
        pass
    import concurrent.futures

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(lambda _: security._fetch_jwks(), range(8)))
    assert fake.calls["n"] == 1
    assert all(r == [_JWK] for r in results)


def test_jwks_rotation_still_works(monkeypatch):
    # Prime cache with old keys only.
    _patch_http(monkeypatch, lambda n: [_JWK] if n == 1 else [_JWK, NEW_JWK])
    assert security._fetch_jwks() == [_JWK]
    # Unknown kid triggers exactly one forced refresh, then resolves.
    key = security._key_for_kid(NEW_KID)
    assert key is not None


def test_jwks_cache_hit_no_fetch(monkeypatch):
    fake = _patch_http(monkeypatch, lambda n: [_JWK])
    security._fetch_jwks()
    assert fake.calls["n"] == 1
    security._fetch_jwks()
    security._fetch_jwks()
    assert fake.calls["n"] == 1


# --- fake Supabase client -------------------------------------------------------


class _Res:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, client, table, cols):
        self.client = client
        self.table = table
        self.cols = cols
        self.filters = []
        self.single = False

    def select(self, *a):
        return self

    def eq(self, k, v):
        self.filters.append((k, v))
        return self

    def maybe_single(self):
        self.single = True
        return self

    def order(self, *a, **k):
        return self

    def limit(self, *a):
        return self

    def in_(self, *a):
        return self

    def execute(self):
        self.client.calls.append((self.table, self.cols, tuple(self.filters)))
        return _Res(self.client.handler(self.table, self.cols, self.filters))


class _FakeSB:
    def __init__(self, handler):
        self.handler = handler
        self.calls: list = []

    def table(self, name):
        outer = self

        class T:
            def select(self, cols):
                return _Query(outer, name, cols)

        return T()


def _profiles_db():
    return {
        "user-a": {"id": "user-a", "organization_id": "org-1",
                   "full_name": "A",
                   "store_users": [{"store_id": "s1", "role": "owner"}]},
        "user-b": {"id": "user-b", "organization_id": "org-1",
                   "full_name": "B",
                   "store_users": [{"store_id": "s1", "role": "cashier"}]},
    }


def _install_fake(monkeypatch, db=None):
    db = db if db is not None else _profiles_db()

    def handler(table, cols, filters):
        if table != "profiles":
            return []
        row = db.get(dict(filters).get("id"))
        if not row:
            return None
        return dict(row)

    sb = _FakeSB(handler)
    monkeypatch.setattr("app.core.database.get_supabase_service", lambda: sb)
    return sb


def test_context_single_query_and_hit(monkeypatch):
    sb = _install_fake(monkeypatch)
    prof, stores = deps._lookup_profile_and_stores("user-a")
    assert prof["full_name"] == "A"
    assert stores == [{"store_id": "s1", "role": "owner"}]
    # Exactly one postgREST round trip, hitting profiles with embed.
    assert len(sb.calls) == 1
    assert sb.calls[0][0] == "profiles"
    assert "store_users" in sb.calls[0][1]
    # Cache hit: no further calls.
    prof2, stores2 = deps._lookup_profile_and_stores("user-a")
    assert (prof2, stores2) == (prof, stores)
    assert len(sb.calls) == 1


def test_context_expiry_refetches(monkeypatch):
    sb = _install_fake(monkeypatch)
    deps._lookup_profile_and_stores("user-a")
    assert len(sb.calls) == 1
    monkeypatch.setattr(settings, "user_context_ttl_seconds", 0)
    deps._lookup_profile_and_stores("user-a")
    assert len(sb.calls) == 2


def test_context_isolation(monkeypatch):
    sb = _install_fake(monkeypatch)
    pa, sa = deps._lookup_profile_and_stores("user-a")
    pb, sb_ = deps._lookup_profile_and_stores("user-b")
    assert pa["id"] == "user-a" and pb["id"] == "user-b"
    assert sa != sb_
    # Re-read A: still A's context, no cross-contamination.
    pa2, sa2 = deps._lookup_profile_and_stores("user-a")
    assert (pa2, sa2) == (pa, sa)
    assert len(sb.calls) == 2  # one per user, then cache


def test_context_unknown_user(monkeypatch):
    sb = _install_fake(monkeypatch)
    assert deps._lookup_profile_and_stores("ghost") == (None, [])
    assert len(sb.calls) == 1


def test_context_invalidation(monkeypatch):
    sb = _install_fake(monkeypatch)
    deps._lookup_profile_and_stores("user-a")
    assert len(sb.calls) == 1
    deps.invalidate_user_context("user-a")
    deps._lookup_profile_and_stores("user-a")
    assert len(sb.calls) == 2
    # Invalidating one user leaves the other cached.
    deps._lookup_profile_and_stores("user-b")
    deps.invalidate_user_context("user-a")
    n = len(sb.calls)
    deps._lookup_profile_and_stores("user-b")
    assert len(sb.calls) == n
