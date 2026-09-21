"""Report routes - read-only aggregations."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.v1.dependencies import (
    get_current_organization,
    get_current_store,
    get_current_user,
    require_org_role,
)
from app.core.exceptions import ForbiddenError
from app.schemas.common import SuccessResponse
from app.services import report_service

router = APIRouter()
VIEWERS = ["owner", "manager"]


def _ctx(org_id: UUID, store: dict | None) -> tuple[str, str]:
    if not store:
        raise ForbiddenError("Store context required")
    return str(org_id), str(store["store_id"])


def _range(from_: str | None, to: str | None) -> tuple[str | None, str | None]:
    return from_, to


@router.get("/sales", dependencies=[Depends(require_org_role(*VIEWERS))])
def sales_report(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None, alias="to"),
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    _=Depends(get_current_user),
):
    o, s = _ctx(org_id, store)
    f, t = _range(from_, to)
    return SuccessResponse(data=report_service.sales(o, s, f, t))


@router.get("/products", dependencies=[Depends(require_org_role(*VIEWERS))])
def products_report(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None, alias="to"),
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    _=Depends(get_current_user),
):
    o, s = _ctx(org_id, store)
    f, t = _range(from_, to)
    return SuccessResponse(data=report_service.products(o, s, f, t))


@router.get("/inventory", dependencies=[Depends(require_org_role(*VIEWERS))])
def inventory_report(
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    _=Depends(get_current_user),
):
    o, s = _ctx(org_id, store)
    return SuccessResponse(data=report_service.inventory(o, s))


@router.get("/profit", dependencies=[Depends(require_org_role(*VIEWERS))])
def profit_report(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None, alias="to"),
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    _=Depends(get_current_user),
):
    o, s = _ctx(org_id, store)
    f, t = _range(from_, to)
    return SuccessResponse(data=report_service.profit(o, s, f, t))


@router.get("/expenses", dependencies=[Depends(require_org_role(*VIEWERS))])
def expenses_report(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None, alias="to"),
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    _=Depends(get_current_user),
):
    o, s = _ctx(org_id, store)
    f, t = _range(from_, to)
    return SuccessResponse(data=report_service.expenses(o, s, f, t))


@router.get("/utang", dependencies=[Depends(require_org_role(*VIEWERS))])
def utang_report(
    org_id: UUID = Depends(get_current_organization),
    _=Depends(get_current_user),
):
    return SuccessResponse(data=report_service.utang(str(org_id)))
