"""Store routes (Phase 0: list my stores)."""
from fastapi import APIRouter, Depends

from app.api.v1.dependencies import CurrentUser, get_current_user
from app.core.database import get_supabase_service
from app.schemas.common import SuccessResponse
from app.schemas.store import StoreWithRole

router = APIRouter()


@router.get("", response_model=SuccessResponse[list[StoreWithRole]], summary="My stores")
def my_stores(user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase_service()
    su = sb.table("store_users").select("store_id,role").eq("user_id", str(user.id)).execute()
    rows = su.data or []
    if not rows:
        return SuccessResponse(data=[])
    store_ids = [r["store_id"] for r in rows]
    st = sb.table("stores").select("*").in_("id", store_ids).execute()
    by_id = {s["id"]: s for s in (st.data or [])}
    out = [
        StoreWithRole(**{**by_id[r["store_id"]], "role": r["role"]})
        for r in rows
        if r["store_id"] in by_id
    ]
    return SuccessResponse(data=out)
