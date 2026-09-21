"""Platform admin routes. Every tenant access here is audit-logged."""
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.v1.dependencies import CurrentUser, require_platform_admin
from app.core.database import get_supabase_service
from app.schemas.common import SuccessResponse
from app.schemas.subscription import SetPlanBody
from app.services import audit_service, notification_service, subscription_service

router = APIRouter()


@router.get("/organizations", response_model=SuccessResponse[list[dict]])
def list_organizations(_: CurrentUser = Depends(require_platform_admin)):
    sb = get_supabase_service()
    orgs = (sb.table("organizations").select("*").order("created_at", desc=True)
            .limit(100).execute().data or [])
    out = []
    for o in orgs:
        try:
            sub = subscription_service.current(o["id"])
            usage = subscription_service.usage(o["id"])
        except Exception:
            sub, usage = {}, {}
        out.append({"organization": o,
                    "plan": (sub.get("plan") or {}).get("name"),
                    "status": sub.get("status"), "usage": usage})
    return SuccessResponse(data=out)


@router.post("/organizations/{org_id}/subscription",
             response_model=SuccessResponse[dict])
def set_subscription(
    org_id: UUID,
    body: SetPlanBody,
    admin: CurrentUser = Depends(require_platform_admin),
):
    sub = subscription_service.set_plan(str(org_id), body.plan, status=body.status)
    audit_service.record(
        str(org_id), "subscription.change", "subscription",
        str(sub.get("id", "")), user_id=str(admin.id),
        metadata={"plan": body.plan, "status": body.status,
                  "by": admin.email})
    notification_service.notify(
        str(org_id), "billing", f"Plan changed to {body.plan} by support",
        f"Status: {body.status}")
    return SuccessResponse(data=sub, message="Subscription updated")
