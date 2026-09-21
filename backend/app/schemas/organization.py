"""Organization schemas (Phase 0 foundation)."""
from uuid import UUID

from pydantic import BaseModel, Field


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    store_name: str = Field(min_length=1, max_length=120)
    store_code: str = Field(default="MAIN", min_length=1, max_length=32)


class OrganizationRead(BaseModel):
    id: UUID
    name: str
    slug: str
    status: str
