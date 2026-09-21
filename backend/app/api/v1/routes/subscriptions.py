"""Subscription routes: plans, current plan, usage."""
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.v1.dependencies import get_current_organization, get_current_user
from app.schemas.common import SuccessResponse
from app.schemas.subscription import PlanRead, SubscriptionRead, UsageRead
from app.services import subscription_service

router = APIRouter()


@router.get("/plans", response_model=SuccessResponse[list[PlanRead]])
def list_plans(_=Depends(get_current_user)):
    return SuccessResponse(data=subscription_service.list_plans())


@router.get("/current", response_model=SuccessResponse[SubscriptionRead])
def current(
    org_id: UUID = Depends(get_current_organization),
):
    return SuccessResponse(data=subscription_service.current(str(org_id)))


@router.get("/usage", response_model=SuccessResponse[UsageRead])
def usage(
    org_id: UUID = Depends(get_current_organization),
):
    sub = subscription_service.current(str(org_id))
    return SuccessResponse(data={**subscription_service.usage(str(org_id)),
                                 "_plan": sub["plan"].get("name")})
