"""Product routes."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.v1.dependencies import (
    CurrentUser,
    get_current_organization,
    get_current_user,
    require_feature,
    require_org_role,
)
from app.schemas.common import SuccessResponse
from app.schemas.product import (
    ProductCreate,
    ProductImportPreview,
    ProductRead,
    ProductUpdate,
    UnitCreate,
    UnitRead,
    UnitUpdate,
)
from app.services import audit_service, product_service, subscription_service

router = APIRouter()

# Reads: Inventory page needs inventory; POS cart lookup needs pos (decision 3).
_PRODUCT_READ = [Depends(require_feature("pos", "inventory"))]
# Writes: inventory feature only (POS implication does not grant writes).
_PRODUCT_WRITE = [
    Depends(require_org_role("owner", "manager")),
    Depends(require_feature("inventory")),
]


# NOTE: /units must be declared before /{product_id} so "units" is not
# captured as a product id.
@router.get("/units", response_model=SuccessResponse[list[UnitRead]],
            dependencies=_PRODUCT_READ)
def list_all_units(
    org_id: UUID = Depends(get_current_organization),
    _=Depends(get_current_user),
):
    return SuccessResponse(data=product_service.list_all_units(str(org_id)))


@router.get("", response_model=SuccessResponse[list[ProductRead]],
            dependencies=_PRODUCT_READ)
def list_products(
    search: str | None = Query(default=None, max_length=120),
    org_id: UUID = Depends(get_current_organization),
    _=Depends(get_current_user),
):
    return SuccessResponse(data=product_service.list_products(str(org_id), search))


@router.get("/{product_id}", response_model=SuccessResponse[ProductRead],
            dependencies=_PRODUCT_READ)
def get_product(
    product_id: UUID,
    org_id: UUID = Depends(get_current_organization),
    _=Depends(get_current_user),
):
    return SuccessResponse(data=product_service.get_product(str(org_id), str(product_id)))


@router.post("", response_model=SuccessResponse[ProductRead], status_code=201,
             dependencies=_PRODUCT_WRITE)
def create_product(
    body: ProductCreate,
    org_id: UUID = Depends(get_current_organization),
    user: CurrentUser = Depends(get_current_user),
):
    subscription_service.check_limit(str(org_id), "products")
    created = product_service.create_product(str(org_id), body.model_dump())
    audit_service.record(
        str(org_id), "product.create", "product", created["id"],
        user_id=str(user.id),
        metadata={"name": created["name"], "retail_price": created["retail_price"]})
    return SuccessResponse(data=created, message="Product created")


@router.put("/{product_id}", response_model=SuccessResponse[ProductRead],
            dependencies=_PRODUCT_WRITE)
def update_product(
    product_id: UUID,
    body: ProductUpdate,
    org_id: UUID = Depends(get_current_organization),
    user: CurrentUser = Depends(get_current_user),
):
    before = product_service.get_product(str(org_id), str(product_id))
    updated = product_service.update_product(
        str(org_id), str(product_id), body.model_dump(exclude_unset=True))
    if body.retail_price is not None and body.retail_price != before.get("retail_price"):
        audit_service.record(
            str(org_id), "product.price_change", "product", str(product_id),
            user_id=str(user.id),
            metadata={"old": before.get("retail_price"),
                      "new": updated.get("retail_price")})
    return SuccessResponse(data=updated)


@router.delete("/{product_id}", response_model=SuccessResponse[ProductRead],
               dependencies=_PRODUCT_WRITE)
def delete_product(
    product_id: UUID,
    org_id: UUID = Depends(get_current_organization),
):
    return SuccessResponse(
        data=product_service.deactivate_product(str(org_id), str(product_id)),
        message="Product deactivated",
    )


@router.post("/import", response_model=SuccessResponse[ProductImportPreview],
             dependencies=_PRODUCT_WRITE)
def import_preview():
    """Phase 1 stub: validates headers only. Full CSV import lands in Phase 2."""
    return SuccessResponse(data=ProductImportPreview())


# Sell units (Phase 4 C1) ----------------------------------------------------


@router.get("/{product_id}/units", response_model=SuccessResponse[list[UnitRead]],
            dependencies=_PRODUCT_READ)
def list_units(
    product_id: UUID,
    org_id: UUID = Depends(get_current_organization),
    _=Depends(get_current_user),
):
    return SuccessResponse(
        data=product_service.list_units(str(org_id), str(product_id)))


@router.post("/{product_id}/units", response_model=SuccessResponse[UnitRead],
             status_code=201,
             dependencies=_PRODUCT_WRITE)
def create_unit(
    product_id: UUID,
    body: UnitCreate,
    org_id: UUID = Depends(get_current_organization),
    _=Depends(get_current_user),
):
    return SuccessResponse(
        data=product_service.create_unit(
            str(org_id), str(product_id), body.model_dump(mode="json")),
        message="Unit added",
    )


@router.put("/{product_id}/units/{unit_id}", response_model=SuccessResponse[UnitRead],
            dependencies=_PRODUCT_WRITE)
def update_unit(
    product_id: UUID,
    unit_id: UUID,
    body: UnitUpdate,
    org_id: UUID = Depends(get_current_organization),
    _=Depends(get_current_user),
):
    return SuccessResponse(
        data=product_service.update_unit(
            str(org_id), str(product_id), str(unit_id),
            body.model_dump(exclude_unset=True)),
        message="Unit updated",
    )


@router.delete("/{product_id}/units/{unit_id}",
               response_model=SuccessResponse[dict],
               dependencies=_PRODUCT_WRITE)
def delete_unit(
    product_id: UUID,
    unit_id: UUID,
    org_id: UUID = Depends(get_current_organization),
    _=Depends(get_current_user),
):
    product_service.delete_unit(str(org_id), str(product_id), str(unit_id))
    return SuccessResponse(data={}, message="Unit removed")
