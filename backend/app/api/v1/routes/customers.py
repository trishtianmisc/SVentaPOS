"""Customer + utang routes."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.v1.dependencies import (
    CurrentUser,
    get_current_organization,
    get_current_store,
    get_current_user,
    require_org_role,
)
from app.core.exceptions import ForbiddenError
from app.schemas.common import SuccessResponse
from app.schemas.customer import (
    CustomerCreate,
    CustomerRead,
    CustomerUpdate,
    LedgerEntry,
    UtangPayment,
)
from app.services import customer_service

router = APIRouter()
MGR = ["owner", "manager"]


def _store(store: dict | None) -> str:
    if not store:
        raise ForbiddenError("Store context required")
    return str(store["store_id"])


@router.get("", response_model=SuccessResponse[list[CustomerRead]])
def list_customers(
    search: str | None = Query(default=None, max_length=120),
    org_id: UUID = Depends(get_current_organization),
    _=Depends(get_current_user),
):
    return SuccessResponse(data=customer_service.list_customers(str(org_id), search))


@router.post("", response_model=SuccessResponse[CustomerRead], status_code=201,
             dependencies=[Depends(require_org_role(*MGR))])
def create_customer(
    body: CustomerCreate,
    org_id: UUID = Depends(get_current_organization),
):
    return SuccessResponse(
        data=customer_service.create_customer(str(org_id), body.model_dump()),
        message="Customer created",
    )


@router.get("/{customer_id}", response_model=SuccessResponse[CustomerRead])
def get_customer(
    customer_id: UUID,
    org_id: UUID = Depends(get_current_organization),
    _=Depends(get_current_user),
):
    return SuccessResponse(
        data=customer_service.get_customer(str(org_id), str(customer_id)))


@router.put("/{customer_id}", response_model=SuccessResponse[CustomerRead],
            dependencies=[Depends(require_org_role(*MGR))])
def update_customer(
    customer_id: UUID,
    body: CustomerUpdate,
    org_id: UUID = Depends(get_current_organization),
):
    return SuccessResponse(data=customer_service.update_customer(
        str(org_id), str(customer_id), body.model_dump(exclude_unset=True)))


@router.get("/{customer_id}/ledger", response_model=SuccessResponse[list[LedgerEntry]])
def ledger(
    customer_id: UUID,
    org_id: UUID = Depends(get_current_organization),
    _=Depends(get_current_user),
):
    return SuccessResponse(
        data=customer_service.ledger(str(org_id), str(customer_id)))


@router.post("/{customer_id}/payment", response_model=SuccessResponse[dict],
             dependencies=[Depends(require_org_role("owner", "manager", "cashier"))])
def record_payment(
    customer_id: UUID,
    body: UtangPayment,
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    user: CurrentUser = Depends(get_current_user),
):
    return SuccessResponse(
        data=customer_service.record_payment(
            str(org_id), _store(store), str(user.id), str(customer_id),
            body.amount, body.method, body.reference, body.notes),
        message="Payment recorded",
    )
