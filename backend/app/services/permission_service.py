"""Org role permission matrix: defaults, load, save, feature checks.

Matrix shape (JSONB on organization_settings.role_matrix):
  { feature: { manager: bool, cashier: bool, staff: bool }, ... }
Empty / missing keys fall back to DEFAULT_MATRIX. Owner always full access.
Staff UI column maps to DB role 'inventory'.
"""
from __future__ import annotations

import threading
import time

from app.core.exceptions import ValidationAppError

FEATURE_KEYS = (
    "dashboard", "pos", "inventory", "customers", "credits", "expenses",
    "sales", "reports", "transfers", "settings", "billing", "suppliers",
    "users",
)
MATRIX_ROLES = ("manager", "cashier", "staff")
MATRIX_CACHE_TTL = 45.0

DEFAULT_MATRIX: dict[str, dict[str, bool]] = {
    "dashboard":  {"manager": True,  "cashier": False, "staff": False},
    "pos":        {"manager": True,  "cashier": True,  "staff": True},
    "inventory":  {"manager": True,  "cashier": True,  "staff": True},
    "customers":  {"manager": True,  "cashier": True,  "staff": True},
    "credits":    {"manager": True,  "cashier": True,  "staff": True},
    "expenses":   {"manager": True,  "cashier": False, "staff": False},
    "sales":      {"manager": True,  "cashier": True,  "staff": False},
    "reports":    {"manager": True,  "cashier": False, "staff": False},
    "transfers":  {"manager": True,  "cashier": False, "staff": True},
    "settings":   {"manager": True,  "cashier": False, "staff": False},
    "billing":    {"manager": False, "cashier": False, "staff": False},
    "suppliers":  {"manager": True,  "cashier": False, "staff": False},
    "users":      {"manager": True,  "cashier": False, "staff": False},
}

_matrix_cache: dict[str, tuple[dict, float]] = {}
_matrix_lock = threading.Lock()


def _sb():
    from app.core.database import get_supabase_service
    return get_supabase_service()


def default_matrix() -> dict[str, dict[str, bool]]:
    return {k: dict(v) for k, v in DEFAULT_MATRIX.items()}


def invalidate_matrix(org_id: str) -> None:
    with _matrix_lock:
        _matrix_cache.pop(str(org_id), None)


def _merge(raw: dict | None) -> dict[str, dict[str, bool]]:
    out = default_matrix()
    if not isinstance(raw, dict):
        return out
    for feat in FEATURE_KEYS:
        row = raw.get(feat)
        if not isinstance(row, dict):
            continue
        for role in MATRIX_ROLES:
            if role in row:
                out[feat][role] = bool(row[role])
    return out


def get_matrix(org_id: str) -> dict[str, dict[str, bool]]:
    key = str(org_id)
    now = time.monotonic()
    with _matrix_lock:
        hit = _matrix_cache.get(key)
        if hit and now - hit[1] < MATRIX_CACHE_TTL:
            return hit[0]
    try:
        res = (
            _sb().table("organization_settings")
            .select("role_matrix")
            .eq("organization_id", key)
            .maybe_single()
            .execute()
        )
        raw = (res.data or {}).get("role_matrix") if res and res.data else None
    except Exception:
        raw = None
    matrix = _merge(raw if isinstance(raw, dict) else None)
    with _matrix_lock:
        _matrix_cache[key] = (matrix, time.monotonic())
    return matrix


def save_matrix(org_id: str, matrix: dict, actor_id: str | None = None) -> dict:
    if not isinstance(matrix, dict):
        raise ValidationAppError("Invalid permission matrix")
    unknown = set(matrix) - set(FEATURE_KEYS)
    if unknown:
        raise ValidationAppError(f"Unknown feature(s): {', '.join(sorted(unknown))}")
    cleaned = default_matrix()
    for feat in FEATURE_KEYS:
        row = matrix.get(feat)
        if not isinstance(row, dict):
            continue
        for role in MATRIX_ROLES:
            if role in row:
                cleaned[feat][role] = bool(row[role])
    try:
        _sb().table("organization_settings").update(
            {"role_matrix": cleaned}
        ).eq("organization_id", str(org_id)).execute()
    except Exception as e:
        raise ValidationAppError(f"Could not save permissions: {e}") from e
    invalidate_matrix(org_id)
    try:
        from app.services import audit_service
        audit_service.record(
            str(org_id), "permission.matrix_update", "organization_settings",
            str(org_id), user_id=actor_id, metadata={"matrix": cleaned},
        )
    except Exception:
        pass
    return cleaned


def _matrix_role(role: str) -> str | None:
    r = (role or "").lower()
    if r == "owner":
        return "owner"
    if r == "inventory":
        return "staff"
    if r in MATRIX_ROLES:
        return r
    return None


def can(role: str, feature: str, matrix: dict | None = None,
        org_id: str | None = None) -> bool:
    """Owner always allowed. Otherwise matrix[feature][mapped role]."""
    mapped = _matrix_role(role)
    if mapped == "owner":
        return True
    if mapped is None or feature not in FEATURE_KEYS:
        return False
    m = matrix if matrix is not None else (get_matrix(org_id) if org_id else default_matrix())
    row = m.get(feature) or DEFAULT_MATRIX.get(feature) or {}
    return bool(row.get(mapped, False))
