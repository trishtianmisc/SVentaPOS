"""Auth schemas - Supabase is IdP, FastAPI resolves context."""
from uuid import UUID

from pydantic import BaseModel


class MeStore(BaseModel):
    store_id: UUID
    role: str


class MeResponse(BaseModel):
    user_id: UUID
    email: str | None = None
    organization_id: UUID | None = None
    full_name: str | None = None
    stores: list[MeStore] = []
