"""Expense routes."""
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.v1.dependencies import (
    CurrentUser,
    get_current_organization,
    get_current_store,
    get_current_user,
    require_feature,
    require_org_role,
)
from app.core.exceptions import ForbiddenError
from app.schemas.common import SuccessResponse
from app.schemas.expense import (
    ExpenseCategoryCreate,
    ExpenseCategoryRead,
    ExpenseCreate,
    ExpenseRead,
)
from app.services import expense_service

router = APIRouter()
MGR = ["owner", "manager"]
_EXPENSES = [Depends(require_feature("expenses"))]
_EXPENSE_WRITE = [
    Depends(require_org_role(*MGR)),
    Depends(require_feature("expenses")),
]


def _ctx(org_id: UUID, store: dict | None) -> tuple[str, str]:
    if not store:
        raise ForbiddenError("Store context required")
    return str(org_id), str(store["store_id"])


@router.get("/categories", response_model=SuccessResponse[list[ExpenseCategoryRead]],
            dependencies=_EXPENSES)
def list_categories(
    org_id: UUID = Depends(get_current_organization),
    _=Depends(get_current_user),
):
    return SuccessResponse(data=expense_service.list_categories(str(org_id)))


@router.post("/categories", response_model=SuccessResponse[list[ExpenseCategoryRead]],
             dependencies=_EXPENSE_WRITE)
def ensure_defaults(
    org_id: UUID = Depends(get_current_organization),
):
    return SuccessResponse(
        data=expense_service.ensure_defaults(str(org_id)),
        message="Default categories ready",
    )


@router.post("/categories/new", response_model=SuccessResponse[ExpenseCategoryRead],
             status_code=201, dependencies=_EXPENSE_WRITE)
def create_category(
    body: ExpenseCategoryCreate,
    org_id: UUID = Depends(get_current_organization),
):
    return SuccessResponse(
        data=expense_service.create_category(str(org_id), body.name),
        message="Category created",
    )


@router.get("", response_model=SuccessResponse[list[ExpenseRead]],
            dependencies=_EXPENSES)
def list_expenses(
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    _=Depends(get_current_user),
):
    o, s = _ctx(org_id, store)
    return SuccessResponse(data=expense_service.list_expenses(o, s))


@router.post("", response_model=SuccessResponse[ExpenseRead], status_code=201,
             dependencies=_EXPENSE_WRITE)
def create_expense(
    body: ExpenseCreate,
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    user: CurrentUser = Depends(get_current_user),
):
    o, s = _ctx(org_id, store)
    return SuccessResponse(
        data=expense_service.create_expense(
            o, s, str(user.id), body.model_dump(mode="json")
        ),
        message="Expense recorded",
    )
