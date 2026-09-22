"""Subscription routes: plans, current plan, usage, upgrade requests."""
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.v1.dependencies import (
    CurrentUser,
    get_current_organization,
    get_current_user,
    require_org_role,
)
from app.schemas.common import SuccessResponse
from app.schemas.subscription import (
    PlanRead,
    SubscriptionRead,
    UpgradeRequestBody,
    UsageRead,
)
from app.services import audit_service, notification_service, subscription_service

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


@router.post("/request-upgrade",
             response_model=SuccessResponse[dict],
             dependencies=[Depends(require_org_role("owner", "manager"))])
def request_upgrade(
    body: UpgradeRequestBody,
    org_id: UUID = Depends(get_current_organization),
    user: CurrentUser = Depends(get_current_user),
):
    """Manual upgrade flow: request a paid plan; a platform admin approves."""
    sub = subscription_service.request_upgrade(
        str(org_id), body.plan, body.note)
    audit_service.record(
        str(org_id), "subscription.upgrade_request", "subscription",
        str(sub.get("id", "")), user_id=str(user.id),
        metadata={"plan": body.plan, "note": body.note or ""})
    return SuccessResponse(data=sub, message="Upgrade requested")


@router.post("/downgrade", response_model=SuccessResponse[SubscriptionRead],
             dependencies=[Depends(require_org_role("owner", "manager"))])
def downgrade(
    org_id: UUID = Depends(get_current_organization),
    user: CurrentUser = Depends(get_current_user),
):
    """Self-serve downgrade to Free (immediate, audited)."""
    sub = subscription_service.downgrade_to_free(str(org_id))
    audit_service.record(
        str(org_id), "subscription.downgrade", "subscription",
        str(sub.get("id", "")), user_id=str(user.id),
        metadata={"plan": "Free"})
    notification_service.notify(
        str(org_id), "billing", "Plan downgraded to Free",
        f"By {user.email or 'staff'}")
    return SuccessResponse(data=subscription_service.current(str(org_id)),
                           message="Downgraded to Free")
