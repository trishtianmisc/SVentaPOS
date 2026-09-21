"""Database + Supabase clients. Production DB = Supabase PostgreSQL.

- FastAPI never exposes service-role key to frontend.
- SQLAlchemy async engine is optional (Supabase postgREST / direct PG).
- RLS is defense in depth; FastAPI authZ is mandatory (docs/05, 11).
"""
from functools import lru_cache

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

_engine = None
_session_factory = None


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


@lru_cache
def get_supabase_anon():
    from supabase import create_client

    settings.check_supabase()
    return create_client(settings.supabase_url, settings.supabase_anon_key)


@lru_cache
def get_supabase_service():
    from supabase import create_client

    if not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY missing (server-only).")
    settings.check_supabase()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
