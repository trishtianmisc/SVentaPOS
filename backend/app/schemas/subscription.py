"""Subscription schemas."""
from uuid import UUID

from pydantic import BaseModel, Field


class PlanRead(BaseModel):
    id: UUID
    name: str
    price: float
    billing_interval: str
    feature_limits: dict = {}
    active: bool


class SubscriptionRead(BaseModel):
    organization_id: UUID
    plan_id: UUID
    status: str
    provider: str
    plan: dict = {}
    limits: dict = {}
    effective_plan: str | None = None
    downgraded: str | None = None
    raw_plan: dict = {}
    current_period_end: str | None = None
    upgrade_request: dict | None = None


class UsageRead(BaseModel):
    stores: int
    products: int
    users: int


class SetPlanBody(BaseModel):
    plan: str = Field(min_length=1, max_length=64)
    status: str = Field(default="active", max_length=32)


class UpgradeRequestBody(BaseModel):
    plan: str = Field(min_length=1, max_length=64)
    note: str | None = Field(default=None, max_length=500)


class BillingWebhook(BaseModel):
    event_id: str = Field(min_length=1, max_length=128)
    organization_id: UUID
    plan: str = Field(min_length=1, max_length=64)
    status: str = Field(default="active", max_length=32)
