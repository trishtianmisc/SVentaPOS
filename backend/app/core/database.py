"""Database + Supabase clients. Production DB = Supabase PostgreSQL.

- FastAPI never exposes service-role key to frontend.
- SQLAlchemy async engine is optional (Supabase postgREST / direct PG).
- RLS is defense in depth; FastAPI authZ is mandatory (docs/05, 11).
"""
from functools import lru_cache

import httpx
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

_engine = None
_session_factory = None
_shared_http: httpx.Client | None = None


def get_engine():
    global _engine
    if _engine is None:
        if not settings.database_url:
            raise RuntimeError("DATABASE_URL missing. See backend/.env.example")
        _engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    return _engine


def get_session_factory():
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), class_=AsyncSession)
    return _session_factory


async def get_db():
    factory = get_session_factory()
    async with factory() as session:
        yield session


_TRANSIENT_ERRORS = (
    httpx.ReadError,
    httpx.ConnectError,
    httpx.ConnectTimeout,
    httpx.ReadTimeout,
    httpx.WriteError,
    httpx.PoolTimeout,
)

_RETRY_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
_MAX_RETRIES = 3
_BACKOFF_BASE = 0.05


class _RetryTransport(httpx.BaseTransport):
    """Retry transient network errors on safe (read-only) requests only."""

    def __init__(self, inner: httpx.BaseTransport, max_retries: int = _MAX_RETRIES):
        self._inner = inner
        self._max_retries = max_retries

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        import time

        attempts = self._max_retries if request.method in _RETRY_METHODS else 1
        last_exc: Exception | None = None
        for attempt in range(attempts):
            try:
                return self._inner.handle_request(request)
            except _TRANSIENT_ERRORS as exc:
                last_exc = exc
                if attempt < attempts - 1:
                    time.sleep(_BACKOFF_BASE * (2 ** attempt))
        raise last_exc  # type: ignore[misc]

    def close(self) -> None:
        self._inner.close()


def _get_shared_http() -> httpx.Client:
    global _shared_http
    if _shared_http is None or _shared_http.is_closed:
        # HTTP/2 over sync httpcore on Windows surfaces WSAEWOULDBLOCK as
        # httpx.ReadError (WinError 10035). Force HTTP/1.1.
        _shared_http = httpx.Client(
            http2=False,
            transport=_RetryTransport(httpx.HTTPTransport(retries=0)),
            timeout=httpx.Timeout(30.0, connect=10.0),
            limits=httpx.Limits(max_connections=40, max_keepalive_connections=20),
        )
    return _shared_http


def close_supabase_http() -> None:
    global _shared_http
    if _shared_http is not None and not _shared_http.is_closed:
        _shared_http.close()
    _shared_http = None


def _client_options():
    from supabase.lib.client_options import SyncClientOptions

    return SyncClientOptions(httpx_client=_get_shared_http())


@lru_cache
def get_supabase_anon():
    from supabase import create_client

    settings.check_supabase()
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key,
        options=_client_options(),
    )


@lru_cache
def get_supabase_service():
    from supabase import create_client

    if not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY missing (server-only).")
    settings.check_supabase()
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
        options=_client_options(),
    )
