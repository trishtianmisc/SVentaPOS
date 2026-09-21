"""Sale schemas. Server computes all totals; tax defaults to 0."""
from uuid import UUID

from pydantic import BaseModel, Field


class SaleItemIn(BaseModel):
    product_id: UUID
    quantity: float = Field(gt=0)
    discount: float = Field(default=0, ge=0)


class SalePaymentIn(BaseModel):
    method: str = Field(min_length=1, max_length=32)
    amount: float = Field(ge=0)
    reference: str | None = None


class SaleCreate(BaseModel):
    items: list[SaleItemIn] = Field(min_length=1)
    payments: list[SalePaymentIn] = Field(min_length=1)
    idempotency_key: str = Field(min_length=8, max_length=128)
    sale_discount: float = Field(default=0, ge=0)
    customer_id: UUID | None = None
    limit_override: bool = False
    limit_reason: str | None = Field(default=None, max_length=500)


class SaleRead(BaseModel):
    sale_id: UUID
    receipt_number: str
    subtotal: float
    discount_amount: float
    tax_amount: float
    total: float
    paid: float | None = None
    change: float | None = None
    status: str
    replayed: bool = False
    customer_id: UUID | None = None
    utang: float = 0
    balance: float = 0


class SaleDetail(BaseModel):
    id: UUID
    receipt_number: str
    subtotal: float
    discount_amount: float
    tax_amount: float
    total: float
    status: str
    created_at: str
    items: list[dict] = []
    payments: list[dict] = []


class SaleVoid(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
