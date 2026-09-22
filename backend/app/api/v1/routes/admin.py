"""Platform admin routes. Every tenant access here is audit-logged."""
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.v1.dependencies import CurrentUser, require_platform_admin
from app.core.database import get_supabase_service
from app.core.exceptions import NotFoundError
from app.schemas.common import SuccessResponse
from app.schemas.subscription import SetPlanBody
from app.services import audit_service, notification_service, subscription_service

router = APIRouter()


def _count(sb, table: str, **filters) -> int:
    q = sb.table(table).select("*", count="exact")
    for col, val in filters.items():
        q = q.eq(col, val)
    return q.execute().count or 0


def _subscription_summary(sub: dict) -> dict:
    return {
        "plan": (sub.get("plan") or {}).get("name"),
        "status": sub.get("status"),
        "effective_plan": sub.get("effective_plan"),
        "downgraded": sub.get("downgraded"),
        "provider": sub.get("provider"),
        "current_period_end": sub.get("current_period_end"),
        "upgrade_request": sub.get("upgrade_request"),
        "limits": sub.get("limits") or {},
    }


@router.get("/metrics", response_model=SuccessResponse[dict])
def platform_metrics(_: CurrentUser = Depends(require_platform_admin)):
    """Platform-wide counters for the admin dashboard (single-table counts)."""
    sb = get_supabase_service()
    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    orgs_total = _count(sb, "organizations")
    orgs_active = _count(sb, "organizations", status="active")
    orgs_suspended = _count(sb, "organizations", status="suspended")
    new_orgs = (sb.table("organizations").select("*", count="exact")
                .gte("created_at", since).execute().count or 0)
    subs = (sb.table("subscriptions")
            .select("status, upgrade_request, subscription_plans(name)")
            .execute().data or [])
    plans: dict[str, int] = {}
    pending = 0
    for s in subs:
        name = (s.get("subscription_plans") or {}).get("name") or "Free"
        plans[name] = plans.get(name, 0) + 1
        if s.get("upgrade_request"):
            pending += 1
    return SuccessResponse(data={
        "organizations": {
            "total": orgs_total,
            "active": orgs_active,
            "suspended": orgs_suspended,
            "last_30_days": new_orgs,
        },
        "totals": {
            "stores": _count(sb, "stores"),
            "products": _count(sb, "products"),
            "users": _count(sb, "profiles"),
        },
        "plans": plans,
        "pending_upgrade_requests": pending,
    })


@router.get("/organizations/{org_id}", response_model=SuccessResponse[dict])
def organization_detail(
    org_id: UUID,
    _: CurrentUser = Depends(require_platform_admin),
):
    sb = get_supabase_service()
    oid = str(org_id)
    res = sb.table("organizations").select("*").eq("id", oid).maybe_single().execute()
    if not res or not res.data:
        raise NotFoundError("Organization not found")
    try:
        sub = subscription_service.current(oid)
        usage = subscription_service.usage(oid)
    except Exception:
        sub, usage = {}, {}
    stores = (sb.table("stores").select("*").eq("organization_id", oid)
              .order("created_at", desc=True).limit(100).execute().data or [])
    members = (sb.table("profiles")
               .select("id, full_name, phone, status, created_at")
               .eq("organization_id", oid).limit(100).execute().data or [])
    audit_logs = audit_service.list_logs(oid, limit=50)
    return SuccessResponse(data={
        "organization": res.data,
        "subscription": _subscription_summary(sub),
        "usage": usage,
        "stores": stores,
        "members": members,
        "audit_logs": audit_logs,
    })


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
        out.append({"organization": o, "usage": usage,
                    **_subscription_summary(sub)})
    return SuccessResponse(data=out)


@router.post("/organizations/{org_id}/subscription",
             response_model=SuccessResponse[dict])
def set_subscription(
    org_id: UUID,
    body: SetPlanBody,
    admin: CurrentUser = Depends(require_platform_admin),
):
    sub = subscription_service.set_plan(str(org_id), body.plan, status=body.status)
    subscription_service.clear_request(str(org_id))
    audit_service.record(
        str(org_id), "subscription.change", "subscription",
        str(sub.get("id", "")), user_id=str(admin.id),
        metadata={"plan": body.plan, "status": body.status,
                  "by": admin.email})
    notification_service.notify(
        str(org_id), "billing", f"Plan changed to {body.plan} by support",
        f"Status: {body.status}")
    return SuccessResponse(data=sub, message="Subscription updated")


@router.get("/upgrade-requests", response_model=SuccessResponse[list[dict]])
def upgrade_requests(_: CurrentUser = Depends(require_platform_admin)):
    """Pending manual upgrade requests across all organizations."""
    sb = get_supabase_service()
    subs = (sb.table("subscriptions").select("*,organizations(name)")
            .order("updated_at", desc=True).limit(200).execute().data or [])
    return SuccessResponse(data=[
        {"organization_id": s["organization_id"],
         "organization_name": (s.get("organizations") or {}).get("name"),
         "plan": (subscription_service.current(s["organization_id"])
                  .get("plan") or {}).get("name"),
         "request": s.get("upgrade_request")}
        for s in subs if s.get("upgrade_request")])


@router.post("/upgrade-requests/{org_id}/decline",
             response_model=SuccessResponse[dict])
def decline_request(
    org_id: UUID,
    admin: CurrentUser = Depends(require_platform_admin),
):
    subscription_service.clear_request(str(org_id))
    audit_service.record(
        str(org_id), "subscription.upgrade_declined", "subscription", "",
        user_id=str(admin.id), metadata={"by": admin.email})
    notification_service.notify(
        str(org_id), "billing", "Upgrade request declined",
        "Contact support for details")
    return SuccessResponse(data={"organization_id": str(org_id)},
                           message="Request declined")
