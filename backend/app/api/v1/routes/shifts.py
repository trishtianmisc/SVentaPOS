"""Shift routes (Phase 4: open/close + Z-report)."""
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.v1.dependencies import (
    CurrentUser,
    get_current_organization,
    get_current_store,
    get_current_user,
    require_feature,
    require_role,
)
from app.core.exceptions import ForbiddenError
from app.schemas.common import SuccessResponse
from app.schemas.shift import ShiftClose, ShiftOpen, ShiftRead
from app.services import shift_service

router = APIRouter()
SHIFT_ROLES = ["owner", "manager", "cashier", "inventory"]
# Shifts support the POS floor; require pos feature on open/close + reads.
_POS = [Depends(require_feature("pos"))]


def _ctx(org_id: UUID, store: dict | None) -> tuple[str, str]:
    if not store:
        raise ForbiddenError("Store context required")
    return str(org_id), str(store["store_id"])


@router.get("/current", response_model=SuccessResponse[ShiftRead | None],
            dependencies=_POS)
def current_shift(
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    _=Depends(get_current_user),
):
    o, s = _ctx(org_id, store)
    return SuccessResponse(data=shift_service.current(o, s))


@router.get("", response_model=SuccessResponse[list[ShiftRead]],
            dependencies=_POS)
def shift_history(
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    _=Depends(get_current_user),
):
    o, s = _ctx(org_id, store)
    return SuccessResponse(data=shift_service.list_shifts(o, s))


@router.post("/open", response_model=SuccessResponse[ShiftRead], status_code=201,
             dependencies=[
                 Depends(require_role(*SHIFT_ROLES)),
                 Depends(require_feature("pos")),
             ])
def open_shift(
    body: ShiftOpen,
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    user: CurrentUser = Depends(get_current_user),
):
    o, s = _ctx(org_id, store)
    return SuccessResponse(
        data=shift_service.open_shift(o, s, str(user.id), body.opening_float),
        message="Shift opened",
    )


@router.post("/{shift_id}/close", response_model=SuccessResponse[ShiftRead],
             dependencies=[
                 Depends(require_role(*SHIFT_ROLES)),
                 Depends(require_feature("pos")),
             ])
def close_shift(
    shift_id: UUID,
    body: ShiftClose,
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    user: CurrentUser = Depends(get_current_user),
):
    o, s = _ctx(org_id, store)
    return SuccessResponse(
        data=shift_service.close_shift(
            o, s, str(user.id), str(shift_id), body.counted_cash, body.notes),
        message="Shift closed",
    )
