"""SaaS subscription service: plans, current subscription, usage limits."""
from app.core.exceptions import ForbiddenError, NotFoundError


def _sb():
    from app.core.database import get_supabase_service

    return get_supabase_service()


def organization_exists(org_id: str) -> bool:
    sb = _sb()
    res = (sb.table("organizations").select("id").eq("id", org_id)
           .maybe_single().execute())
    return bool(res and res.data)


def list_plans() -> list[dict]:
    sb = _sb()
    res = (sb.table("subscription_plans").select("*").eq("active", True)
           .order("price").execute())
    return res.data or []


def current(org_id: str) -> dict:
    """Org's subscription with plan + limits. Free fallback if row missing."""
    sb = _sb()
    res = (sb.table("subscriptions").select("*,subscription_plans(*)")
           .eq("organization_id", org_id).maybe_single().execute())
    if res and res.data:
        row = res.data
        plan = row.pop("subscription_plans", {}) or {}
        return {**row, "plan": plan, "limits": plan.get("feature_limits", {})}
    plan = next((p for p in list_plans() if p["name"] == "Free"), None)
    if not plan:
        raise NotFoundError("Subscription not found")
    return {"organization_id": org_id, "plan_id": plan["id"], "status": "active",
            "provider": "manual", "plan": plan,
            "limits": plan.get("feature_limits", {})}


def usage(org_id: str) -> dict:
    """Counts enforced by limits: stores, products, users."""
    sb = _sb()
    stores = (sb.table("stores").select("*", count="exact")
              .eq("organization_id", org_id).execute())
    products = (sb.table("products").select("*", count="exact")
                .eq("organization_id", org_id).execute())
    users = (sb.table("profiles").select("*", count="exact")
             .eq("organization_id", org_id).execute())
    return {
        "stores": stores.count or 0,
        "products": products.count or 0,
        "users": users.count or 0,
    }


def check_limit(org_id: str, resource: str) -> None:
    """Raise ForbiddenError when the plan limit for resource is reached.
    resource: 'stores' | 'products' | 'users'."""
    sub = current(org_id)
    key = {"stores": "max_stores", "products": "max_products",
           "users": "max_users"}[resource]
    limit = (sub["limits"] or {}).get(key)
    if limit is None:
        return
    if usage(org_id)[resource] >= int(limit):
        raise ForbiddenError(
            f"Plan limit reached: {resource} (max {limit} on "
            f"{sub['plan'].get('name', 'current')} plan)")


def set_plan(org_id: str, plan_name: str, provider: str = "manual",
             status: str = "active") -> dict:
    sb = _sb()
    plan = (sb.table("subscription_plans").select("*").eq("name", plan_name)
            .maybe_single().execute())
    if not plan or not plan.data:
        raise NotFoundError("Plan not found")
    res = (sb.table("subscriptions")
           .upsert({"organization_id": org_id, "plan_id": plan.data["id"],
                    "status": status, "provider": provider},
                   on_conflict="organization_id").execute())
    rows = res.data or []
    return rows[0] if rows else current(org_id)
