"""Category schemas."""
from uuid import UUID

from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=1, max_length=120)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    active: bool | None = None


class CategoryRead(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    slug: str
    active: bool
