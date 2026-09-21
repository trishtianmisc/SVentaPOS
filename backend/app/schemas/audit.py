"""Audit + notification schemas (read models)."""
from uuid import UUID

from pydantic import BaseModel


class AuditRead(BaseModel):
    id: UUID
    action: str
    entity_type: str
    entity_id: str
    user_id: UUID | None = None
    store_id: UUID | None = None
    metadata: dict = {}
    created_at: str


class NotificationRead(BaseModel):
    id: UUID
    type: str
    title: str
    body: str | None = None
    store_id: UUID | None = None
    read_at: str | None = None
    created_at: str
