"""Audit log service. Append-only; best-effort (never breaks mutations)."""
import structlog

log = structlog.get_logger("ventapos.audit")


def _sb():
    from app.core.database import get_supabase_service

    return get_supabase_service()


def record(org_id: str, action: str, entity_type: str, entity_id: str = "",
           user_id: str | None = None, store_id: str | None = None,
           metadata: dict | None = None) -> None:
    try:
        _sb().table("audit_logs").insert({
            "organization_id": org_id, "store_id": store_id,
            "user_id": user_id, "action": action,
            "entity_type": entity_type, "entity_id": str(entity_id or ""),
            "metadata": metadata or {},
        }).execute()
    except Exception as e:
        log.warning("audit_write_failed", action=action, error=str(e)[:120])


def list_logs(org_id: str, limit: int = 100) -> list[dict]:
    sb = _sb()
    res = (sb.table("audit_logs").select("*").eq("organization_id", org_id)
           .order("created_at", desc=True).limit(limit).execute())
    return res.data or []
