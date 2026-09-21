"""Product schemas. Phase 1: base-unit only, no conversion math."""
from uuid import UUID

from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    category_id: UUID | None = None
    name: str = Field(min_length=1, max_length=200)
    sku: str | None = Field(default=None, max_length=64)
    barcode: str | None = Field(default=None, max_length=64)
    brand: str | None = Field(default=None, max_length=120)
    cost_price: float = Field(default=0, ge=0)
    retail_price: float = Field(default=0, ge=0)
    wholesale_price: float | None = Field(default=None, ge=0)
    wholesale_min_qty: float | None = Field(default=None, ge=0)
    minimum_stock: float = Field(default=0, ge=0)
    reorder_level: float = Field(default=0, ge=0)
    track_inventory: bool = True
    active: bool = True


class ProductUpdate(BaseModel):
    category_id: UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    sku: str | None = None
    barcode: str | None = None
    brand: str | None = None
    cost_price: float | None = Field(default=None, ge=0)
    retail_price: float | None = Field(default=None, ge=0)
    wholesale_price: float | None = Field(default=None, ge=0)
    wholesale_min_qty: float | None = Field(default=None, ge=0)
    minimum_stock: float | None = Field(default=None, ge=0)
    reorder_level: float | None = Field(default=None, ge=0)
    track_inventory: bool | None = None
    active: bool | None = None


class ProductRead(BaseModel):
    id: UUID
    organization_id: UUID
    category_id: UUID | None = None
    name: str
    sku: str | None = None
    barcode: str | None = None
    brand: str | None = None
    cost_price: float
    retail_price: float
    wholesale_price: float | None = None
    wholesale_min_qty: float | None = None
    minimum_stock: float
    reorder_level: float
    track_inventory: bool
    active: bool
    quantity: float | None = None  # joined stock for POS listing


class ProductImportPreview(BaseModel):
    """Phase 1 stub: validation preview only, no bulk write."""

    message: str = "CSV import preview is a stub in Phase 1"
