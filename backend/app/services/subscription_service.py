"""SaaS subscription service: plans, current subscription, usage limits.

Phase 7: canceled/past_due/expired-period subscriptions fall back to Free
limits (effective plan), while the paid row is preserved for renewal. The
SQL twin of this rule is is_feature_enabled() (migration 0018) used inside
complete_sale for the wholesale tier."""
from datetime import datetime, timedelta, timezone

from app.core.exceptions import ForbiddenError, NotFoundError, ValidationAppError


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


def _free_plan() -> dict:
    plans = list_plans()
    plan = next((p for p in plans if p["name"] == "Free"), None)
    if not plan:
        raise NotFoundError("Subscription not found")
    return plan


def current(org_id: str) -> dict:
    """Org's subscription with plan + limits. Free fallback if row missing.

    Canceled, past_due, or period-expired paid rows fall back to Free
    LIMITS; the paid row is preserved (raw_plan) so a renewal webhook
    restores it. effective_plan names what is actually enforced."""
    sb = _sb()
    res = (sb.table("subscriptions").select("*,subscription_plans(*)")
           .eq("organization_id", org_id).maybe_single().execute())
    row = res.data if res and res.data else None
    if not row:
        plan = _free_plan()
        return {"organization_id": org_id, "plan_id": plan["id"],
                "status": "active", "provider": "manual", "plan": plan,
                "limits": plan.get("feature_limits", {}),
                "effective_plan": "Free", "downgraded": None,
                "raw_plan": {}, "current_period_end": None,
                "upgrade_request": None}
    plan = row.pop("subscription_plans", {}) or {}
    downgraded = None
    if row.get("status") in ("canceled", "past_due"):
        downgraded = row["status"]
    elif (row.get("status") == "active" and row.get("current_period_end")
            and row["current_period_end"] < _now_iso()):
        downgraded = "expired"
    if downgraded:
        free = _free_plan()
        return {**row, "plan": free,
                "limits": free.get("feature_limits", {}),
                "effective_plan": "Free", "downgraded": downgraded,
                "raw_plan": plan}
    return {**row, "plan": plan, "limits": plan.get("feature_limits", {}),
            "effective_plan": plan.get("name"), "downgraded": None,
            "raw_plan": plan}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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


def require_feature(org_id: str, flag: str) -> None:
    """Raise ForbiddenError when the effective plan disables a feature flag.

    flag: 'advanced_reports' | 'wholesale'. Missing flags default to
    allowed so new flags fail open until seeded."""
    sub = current(org_id)
    if (sub["limits"] or {}).get(flag, True) is False:
        raise ForbiddenError(
            f"Upgrade plan to unlock this feature "
            f"(effective plan: {sub.get('effective_plan', 'Free')})")


def set_plan(org_id: str, plan_name: str, provider: str = "manual",
             status: str = "active") -> dict:
    sb = _sb()
    plan = (sb.table("subscription_plans").select("*").eq("name", plan_name)
            .maybe_single().execute())
    if not plan or not plan.data:
        raise NotFoundError("Plan not found")
    now = datetime.now(timezone.utc)
    res = (sb.table("subscriptions")
           .upsert({"organization_id": org_id, "plan_id": plan.data["id"],
                    "status": status, "provider": provider,
                    "current_period_start": now.isoformat(),
                    "current_period_end": (now + timedelta(days=30)).isoformat(),
                    "upgrade_request": None},
                   on_conflict="organization_id").execute())
    rows = res.data or []
    return rows[0] if rows else current(org_id)


def request_upgrade(org_id: str, plan_name: str,
                    note: str | None = None) -> dict:
    """Manual upgrade flow: org owner asks, platform admin approves.

    The request sits on the subscription row until an admin applies it
    (existing set-plan route clears it) or declines it."""
    sb = _sb()
    plan = (sb.table("subscription_plans").select("*").eq("name", plan_name)
            .eq("active", True).maybe_single().execute())
    if not plan or not plan.data:
        raise NotFoundError("Plan not found")
    if plan_name == "Free":
        raise ValidationAppError("Free needs no approval — use downgrade")
    req = {"plan": plan_name, "note": (note or "").strip() or None,
           "requested_at": _now_iso()}
    res = (sb.table("subscriptions").update({"upgrade_request": req})
           .eq("organization_id", org_id).execute())
    if not (res.data or []):
        raise NotFoundError("Subscription not found")
    return res.data[0]


def clear_request(org_id: str) -> None:
    sb = _sb()
    (sb.table("subscriptions").update({"upgrade_request": None})
     .eq("organization_id", org_id).execute())


def downgrade_to_free(org_id: str) -> dict:
    """Self-serve downgrade. Only Free — upgrades need admin approval."""
    return set_plan(org_id, "Free", provider="manual", status="active")
