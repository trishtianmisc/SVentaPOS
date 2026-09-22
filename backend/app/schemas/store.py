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
    address: str | None = None
    phone: str | None = None
    tax_status: str = "non_vat"
    vat_rate: float = 12
    tin: str | None = None


class StoreWithRole(StoreRead):
    role: str


class StoreSettingsUpdate(BaseModel):
    """Store profile + tax settings (Phase 6). Owner/manager only."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    address: str | None = Field(default=None, max_length=500)
    phone: str | None = Field(default=None, max_length=64)
    tax_status: str | None = Field(default=None, pattern="^(non_vat|vat)$")
    vat_rate: float | None = Field(default=None, ge=0, le=100)
    tin: str | None = Field(default=None, max_length=32)
