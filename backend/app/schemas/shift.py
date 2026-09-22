"""Shift schemas (Phase 4: open/close + Z-report)."""
from uuid import UUID

from pydantic import BaseModel, Field


class ShiftOpen(BaseModel):
    opening_float: float = Field(default=0, ge=0)


class ShiftClose(BaseModel):
    counted_cash: float = Field(ge=0)
    notes: str | None = Field(default=None, max_length=500)


class ShiftRead(BaseModel):
    id: UUID
    status: str
    opened_at: str
    opening_float: float
    closed_at: str | None = None
    expected_cash: float | None = None
    counted_cash: float | None = None
    variance: float | None = None
    notes: str | None = None
    z_report: dict | None = None
