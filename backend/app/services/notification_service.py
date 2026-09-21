"""In-app notifications. Emitted on subscription changes, voids,
limit overrides. Provider push/SMS is deferred (Phase 3 = center only)."""
import structlog

log = structlog.get_logger("ventapos.notifications")


def _sb():
    from app.core.database import get_supabase_service

    return get_supabase_service()


def notify(org_id: str, type: str, title: str, body: str = "",
           store_id: str | None = None, user_id: str | None = None) -> None:
    try:
        _sb().table("notifications").insert({
            "organization_id": org_id, "store_id": store_id,
            "user_id": user_id, "type": type, "title": title, "body": body,
        }).execute()
    except Exception as e:
        log.warning("notify_failed", type=type, error=str(e)[:120])


def list_notifications(org_id: str, unread_only: bool = False) -> list[dict]:
    sb = _sb()
    rows = (sb.table("notifications").select("*").eq("organization_id", org_id)
            .order("created_at", desc=True).limit(50).execute().data or [])
    if unread_only:
        rows = [r for r in rows if not r.get("read_at")]
    return rows


def mark_read(org_id: str, notif_id: str) -> None:
    from datetime import datetime, timezone

    sb = _sb()
    (sb.table("notifications")
     .update({"read_at": datetime.now(timezone.utc).isoformat()})
     .eq("id", notif_id).eq("organization_id", org_id).execute())
