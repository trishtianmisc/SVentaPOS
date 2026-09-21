"""Store schemas (Phase 0 foundation)."""
from uuid import UUID

from pydantic import BaseModel, Field


class StoreCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    code: str = Field(min_length=1, max_length=32)
    address: str | None = None
    phone: str | None = None


class StoreRead(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    code: str
    status: str


class StoreWithRole(StoreRead):
    role: str
