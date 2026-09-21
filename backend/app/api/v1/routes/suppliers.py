"""Supplier routes."""
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.v1.dependencies import (
    get_current_organization,
    get_current_user,
    require_org_role,
)
from app.schemas.common import SuccessResponse
from app.schemas.supplier import SupplierCreate, SupplierRead, SupplierUpdate
from app.services import supplier_service

router = APIRouter()
MGR = ["owner", "manager"]


@router.get("", response_model=SuccessResponse[list[SupplierRead]])
def list_suppliers(
    org_id: UUID = Depends(get_current_organization),
    _=Depends(get_current_user),
):
    return SuccessResponse(data=supplier_service.list_suppliers(str(org_id)))


@router.post("", response_model=SuccessResponse[SupplierRead], status_code=201,
             dependencies=[Depends(require_org_role(*MGR))])
def create_supplier(
    body: SupplierCreate,
    org_id: UUID = Depends(get_current_organization),
):
    return SuccessResponse(
        data=supplier_service.create_supplier(str(org_id), body.model_dump()),
        message="Supplier created",
    )


@router.get("/{supplier_id}", response_model=SuccessResponse[SupplierRead])
def get_supplier(
    supplier_id: UUID,
    org_id: UUID = Depends(get_current_organization),
    _=Depends(get_current_user),
):
    return SuccessResponse(
        data=supplier_service.get_supplier(str(org_id), str(supplier_id)))


@router.put("/{supplier_id}", response_model=SuccessResponse[SupplierRead],
            dependencies=[Depends(require_org_role(*MGR))])
def update_supplier(
    supplier_id: UUID,
    body: SupplierUpdate,
    org_id: UUID = Depends(get_current_organization),
):
    return SuccessResponse(data=supplier_service.update_supplier(
        str(org_id), str(supplier_id), body.model_dump(exclude_unset=True)))
