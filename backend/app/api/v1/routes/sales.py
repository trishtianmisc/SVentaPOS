"""POS sale routes. Totals, change, receipt all computed server-side."""
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.v1.dependencies import (
    CurrentUser,
    get_current_organization,
    get_current_store,
    get_current_user,
    require_role,
)
from app.core.exceptions import ConflictError, ForbiddenError
from app.schemas.common import SuccessResponse
from app.schemas.sale import SaleCreate, SaleDetail, SaleRead, SaleVoid
from app.services import audit_service, notification_service, sale_service, shift_service

router = APIRouter()
POS_ROLES = ["owner", "manager", "cashier"]


def _ctx(org_id: UUID, store: dict | None) -> tuple[str, str]:
    if not store:
        raise ForbiddenError("Store context required")
    return str(org_id), str(store["store_id"])


@router.post("", response_model=SuccessResponse[SaleRead], status_code=201,
             dependencies=[Depends(require_role(*POS_ROLES))])
def create_sale(
    body: SaleCreate,
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    user: CurrentUser = Depends(get_current_user),
):
    o, s = _ctx(org_id, store)
    # Hard shift gate (Phase 4): no open shift, no sale.
    if not shift_service.current(o, s):
        raise ConflictError("No open shift — open a shift to start selling")
    result = sale_service.complete_sale(
        o, s, str(user.id),
        [i.model_dump(mode="json") for i in body.items],
        [p.model_dump() for p in body.payments],
        body.idempotency_key, body.sale_discount,
        str(body.customer_id) if body.customer_id else None,
        body.limit_override, body.limit_reason,
    )
    if body.limit_override and result.get("utang"):
        audit_service.record(
            o, "utang.limit_override", "sale", str(result.get("sale_id")),
            user_id=str(user.id), store_id=s,
            metadata={"reason": body.limit_reason or "",
                      "customer_id": str(body.customer_id)})
        notification_service.notify(
            o, "utang",
            f"Credit limit overridden by {user.email or 'staff'}",
            f"Sale {result.get('receipt_number')}: {body.limit_reason or ''}",
            store_id=s)
    return SuccessResponse(data=result, message="Sale completed")


@router.get("", response_model=SuccessResponse[list[SaleDetail]])
def list_sales(
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    _=Depends(get_current_user),
):
    o, s = _ctx(org_id, store)
    return SuccessResponse(data=sale_service.list_sales(o, s))


@router.get("/{sale_id}", response_model=SuccessResponse[SaleDetail])
def get_sale(
    sale_id: UUID,
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    _=Depends(get_current_user),
):
    o, s = _ctx(org_id, store)
    return SuccessResponse(data=sale_service.get_sale(o, s, str(sale_id)))


@router.post("/{sale_id}/void", response_model=SuccessResponse[dict],
             dependencies=[Depends(require_role("owner", "manager"))])
def void_sale(
    sale_id: UUID,
    body: SaleVoid,
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    user: CurrentUser = Depends(get_current_user),
):
    o, s = _ctx(org_id, store)
    result = sale_service.void_sale(o, s, str(sale_id), str(user.id), body.reason)
    audit_service.record(
        o, "sale.void", "sale", str(sale_id),
        user_id=str(user.id), store_id=s, metadata={"reason": body.reason})
    notification_service.notify(
        o, "sale", f"Sale voided by {user.email or 'staff'}",
        f"Reason: {body.reason}", store_id=s)
    return SuccessResponse(data=result, message="Sale voided")
