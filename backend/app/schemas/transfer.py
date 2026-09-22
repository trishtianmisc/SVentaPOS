"""Stock transfer schemas (Phase 5: draft -> dispatch -> receive)."""
from uuid import UUID

from pydantic import BaseModel, Field


class TransferItemIn(BaseModel):
    product_id: UUID
    quantity: float = Field(gt=0)


class TransferCreate(BaseModel):
    from_store_id: UUID
    to_store_id: UUID
    items: list[TransferItemIn] = Field(min_length=1)


class TransferRead(BaseModel):
    id: UUID
    reference_no: str
    from_store_id: UUID
    to_store_id: UUID
    status: str
    created_at: str
    dispatched_at: str | None = None
    received_at: str | None = None
    items: list[dict] = []
