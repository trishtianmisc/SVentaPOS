"""Store routes (Phase 0: list my stores)."""
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.v1.dependencies import (
    CurrentUser,
    get_current_organization,
    get_current_user,
    require_org_role,
)
from app.core.database import get_supabase_service
from app.core.exceptions import ConflictError, NotFoundError
from app.schemas.common import SuccessResponse
from app.schemas.store import StoreCreate, StoreWithRole
from app.services import audit_service, subscription_service

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


@router.post("", response_model=SuccessResponse[StoreWithRole], status_code=201,
             dependencies=[Depends(require_org_role("owner"))])
def create_store(
    body: StoreCreate,
    org_id: UUID = Depends(get_current_organization),
    user: CurrentUser = Depends(get_current_user),
):
    subscription_service.check_limit(str(org_id), "stores")
    sb = get_supabase_service()
    try:
        res = sb.table("stores").insert({
            "organization_id": str(org_id), "name": body.name.strip(),
            "code": body.code.strip().upper(), "address": body.address,
            "phone": body.phone}).execute()
    except Exception:
        raise ConflictError("Store code already exists")
    created = (res.data or [None])[0]
    if not created:
        raise ConflictError("Store code already exists")
    sb.table("store_users").insert({
        "store_id": created["id"], "user_id": str(user.id),
        "role": "owner"}).execute()
    audit_service.record(
        str(org_id), "store.create", "store", created["id"],
        user_id=str(user.id),
        metadata={"name": created["name"], "code": created["code"]})
    return SuccessResponse(
        data=StoreWithRole(**{**created, "role": "owner"}),
        message="Store created")
