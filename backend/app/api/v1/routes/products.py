"""Product routes."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.v1.dependencies import (
    get_current_organization,
    get_current_user,
    require_org_role,
)
from app.schemas.common import SuccessResponse
from app.schemas.product import ProductCreate, ProductImportPreview, ProductRead, ProductUpdate
from app.services import product_service

router = APIRouter()


@router.get("", response_model=SuccessResponse[list[ProductRead]])
def list_products(
    search: str | None = Query(default=None, max_length=120),
    org_id: UUID = Depends(get_current_organization),
    _=Depends(get_current_user),
):
    return SuccessResponse(data=product_service.list_products(str(org_id), search))


@router.get("/{product_id}", response_model=SuccessResponse[ProductRead])
def get_product(
    product_id: UUID,
    org_id: UUID = Depends(get_current_organization),
    _=Depends(get_current_user),
):
    return SuccessResponse(data=product_service.get_product(str(org_id), str(product_id)))


@router.post("", response_model=SuccessResponse[ProductRead], status_code=201,
             dependencies=[Depends(require_org_role("owner", "manager"))])
def create_product(
    body: ProductCreate,
    org_id: UUID = Depends(get_current_organization),
):
    return SuccessResponse(
        data=product_service.create_product(str(org_id), body.model_dump()),
        message="Product created",
    )


@router.put("/{product_id}", response_model=SuccessResponse[ProductRead],
            dependencies=[Depends(require_org_role("owner", "manager"))])
def update_product(
    product_id: UUID,
    body: ProductUpdate,
    org_id: UUID = Depends(get_current_organization),
):
    return SuccessResponse(data=product_service.update_product(
        str(org_id), str(product_id), body.model_dump(exclude_unset=True)))


@router.delete("/{product_id}", response_model=SuccessResponse[ProductRead],
               dependencies=[Depends(require_org_role("owner", "manager"))])
def delete_product(
    product_id: UUID,
    org_id: UUID = Depends(get_current_organization),
):
    return SuccessResponse(
        data=product_service.deactivate_product(str(org_id), str(product_id)),
        message="Product deactivated",
    )


@router.post("/import", response_model=SuccessResponse[ProductImportPreview],
             dependencies=[Depends(require_org_role("owner", "manager"))])
def import_preview():
    """Phase 1 stub: validates headers only. Full CSV import lands in Phase 2."""
    return SuccessResponse(data=ProductImportPreview())
