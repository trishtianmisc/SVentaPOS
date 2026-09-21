"""Audit log reads (owner/manager). Writes happen inside mutations."""
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.v1.dependencies import get_current_organization, require_org_role
from app.schemas.audit import AuditRead
from app.schemas.common import SuccessResponse
from app.services import audit_service

router = APIRouter()


@router.get("", response_model=SuccessResponse[list[AuditRead]],
            dependencies=[Depends(require_org_role("owner", "manager"))])
def list_audit(
    org_id: UUID = Depends(get_current_organization),
):
    return SuccessResponse(data=audit_service.list_logs(str(org_id)))
