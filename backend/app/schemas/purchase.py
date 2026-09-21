"""Purchase order schemas."""
from uuid import UUID

from pydantic import BaseModel, Field


class POItemIn(BaseModel):
    product_id: UUID
    quantity: float = Field(gt=0)
    unit_cost: float = Field(ge=0)


class POCreate(BaseModel):
    supplier_id: UUID
    items: list[POItemIn] = Field(min_length=1)


class PORead(BaseModel):
    id: UUID
    supplier_id: UUID
    po_number: str
    status: str
    total: float
    created_at: str
    items: list[dict] = []


class ReceiveLineIn(BaseModel):
    item_id: UUID
    quantity: float = Field(gt=0)


class POReceive(BaseModel):
    lines: list[ReceiveLineIn] = Field(min_length=1)
