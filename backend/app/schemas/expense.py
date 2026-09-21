"""Expense schemas."""
from uuid import UUID

from pydantic import BaseModel, Field


class ExpenseCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class ExpenseCategoryRead(BaseModel):
    id: UUID
    name: str
    active: bool


class ExpenseCreate(BaseModel):
    category_id: UUID
    amount: float = Field(gt=0)
    payment_method: str = Field(min_length=1, max_length=32)
    notes: str | None = None
    expense_date: str | None = None


class ExpenseRead(BaseModel):
    id: UUID
    category_id: UUID
    category_name: str | None = None
    amount: float
    payment_method: str
    notes: str | None = None
    expense_date: str
