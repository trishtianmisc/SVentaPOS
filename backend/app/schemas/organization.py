"""Organization schemas (Phase 0 foundation)."""
from uuid import UUID

from pydantic import BaseModel


class OrganizationRead(BaseModel):
    id: UUID
    name: str
    slug: str
    status: str
