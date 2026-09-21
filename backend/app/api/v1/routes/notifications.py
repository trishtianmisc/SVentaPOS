"""In-app notifications."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.v1.dependencies import get_current_organization, get_current_user
from app.schemas.audit import NotificationRead
from app.schemas.common import SuccessResponse
from app.services import notification_service

router = APIRouter()


@router.get("", response_model=SuccessResponse[list[NotificationRead]])
def list_notifications(
    unread_only: bool = Query(default=False),
    org_id: UUID = Depends(get_current_organization),
    _=Depends(get_current_user),
):
    return SuccessResponse(
        data=notification_service.list_notifications(str(org_id), unread_only))


@router.post("/{notif_id}/read", response_model=SuccessResponse[dict])
def mark_read(
    notif_id: UUID,
    org_id: UUID = Depends(get_current_organization),
    _=Depends(get_current_user),
):
    notification_service.mark_read(str(org_id), str(notif_id))
    return SuccessResponse(data={}, message="Marked as read")
