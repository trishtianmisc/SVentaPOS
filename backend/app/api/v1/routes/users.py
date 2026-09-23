"""Org user management: list, invite/add by email, change role, remove.

Writes are owner-only. List is owner/manager. Missing accounts become
pending invites (Supabase Auth email + copy-link); free accounts attach
immediately. Also hosts GET/PUT /users/role-permissions (permission matrix)
and invite accept (any authenticated invitee)."""
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.v1.dependencies import (
    CurrentUser,
    get_current_organization,
    get_current_store,
    get_current_user,
    require_feature,
    require_org_role,
)
from app.schemas.common import SuccessResponse
from app.schemas.user import BranchStore, UserAdd, UserRead, UserRoleUpdate
from app.services import invite_service, permission_service, user_service

router = APIRouter()


class InviteRead(BaseModel):
    id: str
    email: str
    role: str
    status: str
    store_id: str | None = None
    invite_url: str | None = None
    expires_at: str | None = None
    created_at: str | None = None
    email_error: str | None = None


# One model for attach + invite: a Pydantic union picks UserRead first and
# strips invite_url (smart-union scores extra filled fields higher).
class UserAddResult(BaseModel):
    id: str
    email: str | None = None
    role: str
    status: str = "active"
    full_name: str | None = None
    phone: str | None = None
    roles: list[dict] = []
    is_self: bool = False
    last_login: str | None = None
    store_id: str | None = None
    invite_url: str | None = None
    expires_at: str | None = None
    created_at: str | None = None
    email_error: str | None = None


class InviteAccept(BaseModel):
    token: str = Field(min_length=16, max_length=512)


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


@router.get("/branch-stores",
            response_model=SuccessResponse[list[BranchStore]],
            dependencies=[
                Depends(require_org_role("owner", "manager")),
                Depends(require_feature("users")),
            ],
            summary="All org branches for Add Team Member (first = HQ)")
def branch_stores(
    org_id: UUID = Depends(get_current_organization),
):
    return SuccessResponse(data=user_service.branch_stores(str(org_id)))


@router.get("/invites", response_model=SuccessResponse[list[InviteRead]],
            dependencies=[
                Depends(require_org_role("owner", "manager")),
                Depends(require_feature("users")),
            ],
            summary="Pending org invites")
def list_invites(
    org_id: UUID = Depends(get_current_organization),
):
    return SuccessResponse(data=invite_service.list_invites(str(org_id)))


@router.post("/invites/{invite_id}/resend", response_model=SuccessResponse[InviteRead],
             dependencies=[Depends(require_org_role("owner"))],
             summary="Resend invite (new token + email)")
def resend_invite(
    invite_id: UUID,
    org_id: UUID = Depends(get_current_organization),
    user: CurrentUser = Depends(get_current_user),
):
    return SuccessResponse(
        data=invite_service.resend_invite(str(org_id), str(invite_id), str(user.id)),
        message="Invite resent")


@router.delete("/invites/{invite_id}", response_model=SuccessResponse[dict],
               dependencies=[Depends(require_org_role("owner"))],
               summary="Revoke invite")
def revoke_invite(
    invite_id: UUID,
    org_id: UUID = Depends(get_current_organization),
    user: CurrentUser = Depends(get_current_user),
):
    return SuccessResponse(
        data=invite_service.revoke_invite(str(org_id), str(invite_id), str(user.id)),
        message="Invite revoked")


@router.get("/accept", response_model=SuccessResponse[dict],
            summary="Preview invite (email/role before sign-in)")
def peek_invite(token: str):
    return SuccessResponse(data=invite_service.peek_invite(token))


@router.post("/accept", response_model=SuccessResponse[dict],
             summary="Accept invite for signed-in user")
def accept_invite(
    body: InviteAccept,
    user: CurrentUser = Depends(get_current_user),
):
    return SuccessResponse(
        data=invite_service.accept_invite(
            body.token, str(user.id), user.email, user.full_name),
        message="Invite accepted")


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


# UserAddResult covers both attach and invite in one model so invite_url
# is never stripped by union/coercion.
@router.post("", response_model=SuccessResponse[UserAddResult],
             status_code=201,
             dependencies=[Depends(require_org_role("owner"))],
             summary="Create account (password) or invite member")
def add_user(
    body: UserAdd,
    org_id: UUID = Depends(get_current_organization),
    user: CurrentUser = Depends(get_current_user),
    store: dict | None = Depends(get_current_store),
):
    store_id = body.store_id or (store or {}).get("store_id")
    result = invite_service.create_invite(
        str(org_id), body.email, body.role,
        str(store_id) if store_id else None, str(user.id),
        full_name=body.full_name, phone=body.phone,
        password=body.password)
    if result.get("status") == "invited":
        return SuccessResponse(data=result, message="Invite sent")
    if result.get("status") == "active" and body.password:
        return SuccessResponse(data=result, message="Account created")
    return SuccessResponse(data=result, message="User added")


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
