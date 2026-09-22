"""Stock transfer routes (Phase 5: draft -> dispatch -> receive)."""
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.v1.dependencies import (
    CurrentUser,
    get_current_organization,
    get_current_user,
    require_org_role,
)
from app.schemas.common import SuccessResponse
from app.schemas.transfer import TransferCreate, TransferRead
from app.services import transfer_service

router = APIRouter()
MGR = ["owner", "manager"]
MOVE_ROLES = ["owner", "manager", "inventory"]


@router.get("", response_model=SuccessResponse[list[TransferRead]])
def list_transfers(
    org_id: UUID = Depends(get_current_organization),
    user: CurrentUser = Depends(get_current_user),
):
    return SuccessResponse(
        data=transfer_service.list_transfers(str(org_id), str(user.id)))


@router.post("", response_model=SuccessResponse[TransferRead], status_code=201,
             dependencies=[Depends(require_org_role(*MOVE_ROLES))])
def create_transfer(
    body: TransferCreate,
    org_id: UUID = Depends(get_current_organization),
    user: CurrentUser = Depends(get_current_user),
):
    return SuccessResponse(
        data=transfer_service.create_transfer(
            str(org_id), str(user.id), str(body.from_store_id),
            str(body.to_store_id),
            [{"product_id": str(i.product_id), "quantity": i.quantity}
             for i in body.items]),
        message="Transfer drafted",
    )


@router.get("/{transfer_id}", response_model=SuccessResponse[TransferRead])
def get_transfer(
    transfer_id: UUID,
    org_id: UUID = Depends(get_current_organization),
    user: CurrentUser = Depends(get_current_user),
):
    return SuccessResponse(
        data=transfer_service.get_transfer(
            str(org_id), str(user.id), str(transfer_id)))


@router.post("/{transfer_id}/dispatch",
             response_model=SuccessResponse[TransferRead],
             dependencies=[Depends(require_org_role(*MGR))])
def dispatch_transfer(
    transfer_id: UUID,
    org_id: UUID = Depends(get_current_organization),
    user: CurrentUser = Depends(get_current_user),
):
    return SuccessResponse(
        data=transfer_service.dispatch(
            str(org_id), str(user.id), str(transfer_id)),
        message="Transfer dispatched",
    )


@router.post("/{transfer_id}/receive",
             response_model=SuccessResponse[TransferRead],
             dependencies=[Depends(require_org_role(*MOVE_ROLES))])
def receive_transfer(
    transfer_id: UUID,
    org_id: UUID = Depends(get_current_organization),
    user: CurrentUser = Depends(get_current_user),
):
    return SuccessResponse(
        data=transfer_service.receive(
            str(org_id), str(user.id), str(transfer_id)),
        message="Transfer received",
    )


@router.post("/{transfer_id}/cancel",
             response_model=SuccessResponse[TransferRead],
             dependencies=[Depends(require_org_role(*MGR))])
def cancel_transfer(
    transfer_id: UUID,
    org_id: UUID = Depends(get_current_organization),
    user: CurrentUser = Depends(get_current_user),
):
    return SuccessResponse(
        data=transfer_service.cancel(
            str(org_id), str(user.id), str(transfer_id)),
        message="Transfer cancelled",
    )
