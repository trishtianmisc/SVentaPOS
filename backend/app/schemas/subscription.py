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


class UsageRead(BaseModel):
    stores: int
    products: int
    users: int


class SetPlanBody(BaseModel):
    plan: str = Field(min_length=1, max_length=64)
    status: str = Field(default="active", max_length=32)


class BillingWebhook(BaseModel):
    event_id: str = Field(min_length=1, max_length=128)
    organization_id: UUID
    plan: str = Field(min_length=1, max_length=64)
    status: str = Field(default="active", max_length=32)
