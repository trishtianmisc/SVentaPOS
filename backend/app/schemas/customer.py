"""Customer + utang ledger schemas. Ledger is append-only."""
from uuid import UUID

from pydantic import BaseModel, Field


class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=32)
    address: str | None = None
    credit_limit: float | None = Field(default=None, ge=0)


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = None
    address: str | None = None
    credit_limit: float | None = Field(default=None, ge=0)
    active: bool | None = None


class CustomerRead(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    phone: str | None = None
    address: str | None = None
    credit_limit: float | None = None
    active: bool
    balance: float = 0


class LedgerEntry(BaseModel):
    id: UUID
    transaction_type: str
    amount: float
    reference_type: str | None = None
    notes: str | None = None
    created_at: str


class UtangPayment(BaseModel):
    amount: float = Field(gt=0)
    method: str = Field(min_length=1, max_length=32)
    reference: str | None = None
    notes: str | None = None
