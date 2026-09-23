"""Org user management: list, add by email, change role, remove.

Writes are owner-only. List is owner/manager. No invite email service —
Model A attaches an already-registered account by email.
Also hosts GET/PUT /users/role-permissions (org permission matrix)."""
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
from app.schemas.common import SuccessResponse
from app.schemas.user import UserAdd, UserRead, UserRoleUpdate
from app.services import permission_service, user_service

router = APIRouter()


@router.get("", response_model=SuccessResponse[list[UserRead]],
            dependencies=[
                Depends(require_org_role("owner", "manager")),
                Depends(require_feature("users")),
            ],
            summary="Org members")
def list_users(
    org_id: UUID = Depends(get_current_organization),
    user: CurrentUser = Depends(get_current_user),
):
    return SuccessResponse(
        data=user_service.list_members(str(org_id), str(user.id)))


@router.get("/role-permissions",
            response_model=SuccessResponse[dict[str, dict[str, bool]]],
            summary="Role permission matrix (any org member; read-only)")
def get_role_permissions(
    org_id: UUID = Depends(get_current_organization),
):
    # Every signed-in session loads this to filter nav/routes — cashiers
    # and inventory must not 403. Writes stay owner-only below.
    return SuccessResponse(data=permission_service.get_matrix(str(org_id)))


@router.put("/role-permissions",
            response_model=SuccessResponse[dict[str, dict[str, bool]]],
            dependencies=[Depends(require_org_role("owner"))],
            summary="Update role permission matrix (owner)")
def put_role_permissions(
    body: dict[str, dict[str, bool]],
    org_id: UUID = Depends(get_current_organization),
    user: CurrentUser = Depends(get_current_user),
):
    return SuccessResponse(
        data=permission_service.save_matrix(str(org_id), body, str(user.id)),
        message="Permissions updated")


@router.post("", response_model=SuccessResponse[UserRead], status_code=201,
             dependencies=[Depends(require_org_role("owner"))],
             summary="Add existing account by email")
def add_user(
    body: UserAdd,
    org_id: UUID = Depends(get_current_organization),
    user: CurrentUser = Depends(get_current_user),
    store: dict | None = Depends(get_current_store),
):
    store_id = body.store_id or (store or {}).get("store_id")
    return SuccessResponse(
        data=user_service.add_member(
            str(org_id), body.email, body.role,
            str(store_id) if store_id else None, str(user.id)),
        message="User added")


@router.patch("/{user_id}", response_model=SuccessResponse[UserRead],
              dependencies=[Depends(require_org_role("owner"))],
              summary="Change member role")
def update_role(
    user_id: UUID,
    body: UserRoleUpdate,
    org_id: UUID = Depends(get_current_organization),
    user: CurrentUser = Depends(get_current_user),
):
    return SuccessResponse(
        data=user_service.change_role(
            str(org_id), str(user_id), body.role, str(user.id)),
        message="Role updated")


@router.delete("/{user_id}", response_model=SuccessResponse[dict],
               dependencies=[Depends(require_org_role("owner"))],
               summary="Remove member from business")
def remove_user(
    user_id: UUID,
    org_id: UUID = Depends(get_current_organization),
    user: CurrentUser = Depends(get_current_user),
):
    user_service.remove_member(str(org_id), str(user_id), str(user.id))
    return SuccessResponse(data={"id": str(user_id)}, message="User removed")
