"""Supplier schemas."""
from uuid import UUID

from pydantic import BaseModel, Field


class SupplierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    contact_name: str | None = None
    phone: str | None = None
    address: str | None = None
    notes: str | None = None


class SupplierUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    contact_name: str | None = None
    phone: str | None = None
    address: str | None = None
    notes: str | None = None
    active: bool | None = None


class SupplierRead(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    contact_name: str | None = None
    phone: str | None = None
    address: str | None = None
    notes: str | None = None
    active: bool
