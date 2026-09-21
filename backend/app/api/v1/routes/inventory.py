"""Inventory routes."""
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.v1.dependencies import (
    CurrentUser,
    get_current_organization,
    get_current_store,
    get_current_user,
    require_role,
)
from app.schemas.common import SuccessResponse
from app.schemas.inventory import InventoryAdjust, InventoryRead, MovementRead
from app.services import inventory_service

router = APIRouter()


def _store_id(store: dict | None) -> str:
    from app.core.exceptions import ForbiddenError

    if not store:
        raise ForbiddenError("Store context required")
    return str(store["store_id"])


@router.get("", response_model=SuccessResponse[list[InventoryRead]])
def list_inventory(
    store: dict | None = Depends(get_current_store),
    _=Depends(get_current_user),
):
    return SuccessResponse(data=inventory_service.list_inventory(_store_id(store)))


@router.get("/low-stock", response_model=SuccessResponse[list[InventoryRead]])
def low_stock(
    store: dict | None = Depends(get_current_store),
    _=Depends(get_current_user),
):
    return SuccessResponse(data=inventory_service.low_stock(_store_id(store)))


@router.get("/movements", response_model=SuccessResponse[list[MovementRead]])
def movements(
    store: dict | None = Depends(get_current_store),
    _=Depends(get_current_user),
):
    return SuccessResponse(data=inventory_service.movements(_store_id(store)))


@router.get("/{product_id}", response_model=SuccessResponse[InventoryRead])
def get_stock(
    product_id: UUID,
    store: dict | None = Depends(get_current_store),
    _=Depends(get_current_user),
):
    return SuccessResponse(
        data=inventory_service.get_stock(_store_id(store), str(product_id)))


@router.post("/adjust", response_model=SuccessResponse[dict],
             dependencies=[Depends(require_role("owner", "manager", "inventory"))])
def adjust(
    body: InventoryAdjust,
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    user: CurrentUser = Depends(get_current_user),
):
    return SuccessResponse(
        data=inventory_service.adjust(
            str(org_id), _store_id(store), str(user.id), str(body.product_id),
            body.quantity, body.movement_type, body.reason, body.unit_cost),
        message="Stock adjusted",
    )
