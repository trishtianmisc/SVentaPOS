"""Billing webhooks. Provider-agnostic HMAC-SHA256 verification.

Expected JSON: {event_id, organization_id, plan, status}.
Signature: hex HMAC-SHA256 of the raw request body with BILLING_WEBHOOK_SECRET,
sent in the X-Signature header. Never trust frontend payment state.
Idempotency: event_id is recorded in the audit log; replays are acked.
"""
import hashlib
import hmac

from fastapi import APIRouter, Depends, Header, Request

from app.api.v1.dependencies import CurrentUser, require_platform_admin
from app.core.config import settings
from app.core.exceptions import ForbiddenError, ValidationAppError
from app.schemas.common import SuccessResponse
from app.schemas.subscription import BillingWebhook
from app.services import audit_service, notification_service, subscription_service

router = APIRouter()


def _verify(raw: bytes, signature: str | None) -> None:
    secret = settings.billing_webhook_secret
    if not secret:
        raise ValidationAppError("Billing provider is not configured")
    if not signature:
        raise ForbiddenError("Missing webhook signature")
    expect = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expect, signature):
        raise ForbiddenError("Invalid webhook signature")


@router.post("/billing", response_model=SuccessResponse[dict])
async def billing_webhook(
    request: Request,
    x_signature: str | None = Header(default=None),
):
    raw = await request.body()
    _verify(raw, x_signature)
    import json as _json

    try:
        body = BillingWebhook(**_json.loads(raw.decode()))
    except Exception:
        raise ValidationAppError("Invalid webhook payload")
    from app.core.exceptions import NotFoundError

    if not subscription_service.organization_exists(str(body.organization_id)):
        raise NotFoundError("Organization not found")
    # Idempotency: already-processed events are acked without side effects.
    seen = audit_service.list_logs(str(body.organization_id), limit=200)
    if any(r.get("entity_type") == "webhook" and r.get("entity_id") == body.event_id
           for r in seen):
        return SuccessResponse(data={"replayed": True}, message="Already processed")
    sub = subscription_service.set_plan(
        str(body.organization_id), body.plan,
        provider=settings.billing_provider or "webhook",
        status=body.status)
    audit_service.record(
        str(body.organization_id), "subscription.webhook", "webhook",
        body.event_id, metadata={"plan": body.plan, "status": body.status})
    notification_service.notify(
        str(body.organization_id), "billing",
        f"Subscription updated to {body.plan}",
        f"Status: {body.status} via {settings.billing_provider}")
    return SuccessResponse(data={"plan": body.plan, "status": sub.get("status")},
                           message="Subscription updated")


@router.get("/billing/config")
def billing_config(_: CurrentUser = Depends(require_platform_admin)):
    return SuccessResponse(data={
        "provider": settings.billing_provider,
        "configured": bool(settings.billing_webhook_secret),
    })
