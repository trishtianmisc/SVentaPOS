"""Business calendar helpers: local date bounds ↔ UTC `created_at`.

`sales.created_at` is stored in UTC. UI date filters (Today/Yesterday,
report ranges) are the business local day (default UTC+8, Asia/Manila).
Convert local YYYY-MM-DD bounds to UTC instants for queries, and convert
UTC timestamps back to local days before range checks / by_day grouping.
"""
from datetime import date, datetime, timedelta, timezone

from app.core.config import settings


def business_tz() -> timezone:
    return timezone(timedelta(hours=settings.business_tz_offset_hours))


def local_day_bounds_utc(day: str) -> tuple[str, str]:
    """Local YYYY-MM-DD → (start_utc_iso, end_utc_inclusive_iso)."""
    d = date.fromisoformat(day)
    start_local = datetime(d.year, d.month, d.day, tzinfo=business_tz())
    end_local = start_local + timedelta(days=1) - timedelta(microseconds=1)
    start_utc = start_local.astimezone(timezone.utc)
    end_utc = end_local.astimezone(timezone.utc)
    return start_utc.isoformat(), end_utc.isoformat()


def created_at_local_day(iso: str | None) -> str:
    """UTC/ISO `created_at` → local YYYY-MM-DD (or '' if unparseable)."""
    if not iso:
        return ""
    raw = str(iso).strip()
    if not raw:
        return ""
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return raw[:10]
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(business_tz()).date().isoformat()


def local_today() -> date:
    return datetime.now(business_tz()).date()
