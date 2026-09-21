"""Category routes."""
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.v1.dependencies import (
    CurrentUser,
    get_current_organization,
    get_current_user,
    require_org_role,
)
from app.schemas.category import (
    CategoryCreate,
    CategoryRead,
    CategoryUpdate,
)
from app.schemas.common import SuccessResponse
from app.services import category_service

router = APIRouter()


@router.get("", response_model=SuccessResponse[list[CategoryRead]])
def list_categories(
    org_id: UUID = Depends(get_current_organization),
    _=Depends(get_current_user),
):
    return SuccessResponse(data=category_service.list_categories(str(org_id)))


@router.post("", response_model=SuccessResponse[CategoryRead], status_code=201,
             dependencies=[Depends(require_org_role("owner", "manager"))])
def create_category(
    body: CategoryCreate,
    org_id: UUID = Depends(get_current_organization),
):
    return SuccessResponse(
        data=category_service.create_category(str(org_id), body.name, body.slug),
        message="Category created",
    )


@router.put("/{category_id}", response_model=SuccessResponse[CategoryRead],
            dependencies=[Depends(require_org_role("owner", "manager"))])
def update_category(
    category_id: UUID,
    body: CategoryUpdate,
    org_id: UUID = Depends(get_current_organization),
):
    return SuccessResponse(data=category_service.update_category(
        str(org_id), str(category_id), body.model_dump(exclude_unset=True)))


@router.delete("/{category_id}", response_model=SuccessResponse[CategoryRead],
               dependencies=[Depends(require_org_role("owner", "manager"))])
def delete_category(
    category_id: UUID,
    org_id: UUID = Depends(get_current_organization),
):
    return SuccessResponse(
        data=category_service.deactivate_category(str(org_id), str(category_id)),
        message="Category deactivated",
    )
