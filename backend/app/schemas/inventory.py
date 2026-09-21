"""Inventory schemas. Every stock change writes a movement row."""
from uuid import UUID

from pydantic import BaseModel, Field


class InventoryAdjust(BaseModel):
    product_id: UUID
    quantity: float = Field(description="Signed delta, e.g. +10 receive, -2 damage")
    movement_type: str = Field(
        default="ADJUSTMENT",
        description="ADJUSTMENT, PURCHASE, DAMAGE, EXPIRED",
    )
    reason: str = Field(min_length=3, max_length=500)
    unit_cost: float | None = Field(default=None, ge=0)


class InventoryRead(BaseModel):
    store_id: UUID
    product_id: UUID
    quantity: float
    product_name: str | None = None
    minimum_stock: float | None = None
    reorder_level: float | None = None


class MovementRead(BaseModel):
    id: UUID
    movement_type: str
    quantity: float
    product_id: UUID
    reference_type: str | None = None
    notes: str | None = None
    created_at: str
