"""Organization routes (Phase 0: read current org)."""
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.v1.dependencies import get_current_organization, get_current_user
from app.core.database import get_supabase_service
from app.core.exceptions import NotFoundError
from app.schemas.common import SuccessResponse
from app.schemas.organization import OrganizationRead

router = APIRouter()


@router.get(
    "/current",
    response_model=SuccessResponse[OrganizationRead],
    summary="Current organization",
)
def current_org(
    org_id: UUID = Depends(get_current_organization),
    _=Depends(get_current_user),
):
    sb = get_supabase_service()
    res = sb.table("organizations").select("*").eq("id", str(org_id)).maybe_single().execute()
    if not res or not res.data:
        raise NotFoundError("Organization not found")
    return SuccessResponse(data=OrganizationRead(**res.data))
