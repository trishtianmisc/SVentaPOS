"""Purchase order routes."""
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.v1.dependencies import (
    CurrentUser,
    get_current_organization,
    get_current_store,
    get_current_user,
    require_org_role,
)
from app.core.exceptions import ForbiddenError
from app.schemas.common import SuccessResponse
from app.schemas.purchase import POCreate, PORead, POReceive
from app.services import purchase_service

router = APIRouter()
MGR = ["owner", "manager"]
RECEIVE_ROLES = ["owner", "manager", "inventory"]


def _ctx(org_id: UUID, store: dict | None) -> tuple[str, str]:
    if not store:
        raise ForbiddenError("Store context required")
    return str(org_id), str(store["store_id"])


@router.get("", response_model=SuccessResponse[list[PORead]])
def list_pos(
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    _=Depends(get_current_user),
):
    o, s = _ctx(org_id, store)
    return SuccessResponse(data=purchase_service.list_pos(o, s))


@router.post("", response_model=SuccessResponse[PORead], status_code=201,
             dependencies=[Depends(require_org_role(*MGR))])
def create_po(
    body: POCreate,
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    user: CurrentUser = Depends(get_current_user),
):
    o, s = _ctx(org_id, store)
    return SuccessResponse(
        data=purchase_service.create_po(
            o, s, str(user.id), str(body.supplier_id),
            [i.model_dump(mode="json") for i in body.items]),
        message="Purchase order created",
    )


@router.get("/{po_id}", response_model=SuccessResponse[PORead])
def get_po(
    po_id: UUID,
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    _=Depends(get_current_user),
):
    o, s = _ctx(org_id, store)
    return SuccessResponse(data=purchase_service.get_po(o, s, str(po_id)))


@router.post("/{po_id}/approve", response_model=SuccessResponse[PORead],
             dependencies=[Depends(require_org_role(*MGR))])
def approve_po(
    po_id: UUID,
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
):
    o, s = _ctx(org_id, store)
    return SuccessResponse(
        data=purchase_service.set_status(o, s, str(po_id), "ORDERED"),
        message="PO marked ordered",
    )


@router.post("/{po_id}/cancel", response_model=SuccessResponse[PORead],
             dependencies=[Depends(require_org_role(*MGR))])
def cancel_po(
    po_id: UUID,
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
):
    o, s = _ctx(org_id, store)
    return SuccessResponse(
        data=purchase_service.set_status(o, s, str(po_id), "CANCELLED"),
        message="PO cancelled",
    )


@router.post("/{po_id}/receive", response_model=SuccessResponse[PORead],
             dependencies=[Depends(require_org_role(*RECEIVE_ROLES))])
def receive_po(
    po_id: UUID,
    body: POReceive,
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    user: CurrentUser = Depends(get_current_user),
):
    o, s = _ctx(org_id, store)
    return SuccessResponse(
        data=purchase_service.receive(
            o, s, str(user.id), str(po_id),
            [ln.model_dump(mode="json") for ln in body.lines]),
        message="Stock received",
    )
