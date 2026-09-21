"""Store schemas (Phase 0 foundation)."""
from uuid import UUID

from pydantic import BaseModel


class StoreRead(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    code: str
    status: str


class StoreWithRole(StoreRead):
    role: str
