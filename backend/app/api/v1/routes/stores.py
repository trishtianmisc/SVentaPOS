"""Store routes (Phase 0: list my stores)."""
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.v1.dependencies import (
    CurrentUser,
    get_current_organization,
    get_current_store,
    get_current_user,
    require_feature,
    require_org_role,
    require_role,
)
from app.core.database import get_supabase_service
from app.core.exceptions import ConflictError, NotFoundError
from app.schemas.common import SuccessResponse
from app.schemas.store import StoreCreate, StoreSettingsUpdate, StoreWithRole
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
             dependencies=[
                 Depends(require_org_role("owner")),
                 Depends(require_feature("settings")),
             ])
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


@router.patch("/settings", response_model=SuccessResponse[StoreWithRole],
              dependencies=[
                  Depends(require_role("owner", "manager")),
                  Depends(require_feature("settings")),
              ])
def update_settings(
    body: StoreSettingsUpdate,
    org_id: UUID = Depends(get_current_organization),
    store: dict | None = Depends(get_current_store),
    user: CurrentUser = Depends(get_current_user),
):
    """Store profile + tax settings (Phase 6) for the current store."""
    if not store:
        from app.core.exceptions import ForbiddenError

        raise ForbiddenError("Store context required")
    patch = body.model_dump(exclude_unset=True, exclude_none=True)
    if "tax_status" in patch and patch["tax_status"] not in ("non_vat", "vat"):
        from app.core.exceptions import ValidationAppError

        raise ValidationAppError("Invalid tax status")
    sb = get_supabase_service()
    if patch:
        clean = {k: (v.strip() if isinstance(v, str) else v)
                 for k, v in patch.items()}
        if clean.get("name") == "":
            from app.core.exceptions import ValidationAppError

            raise ValidationAppError("Store name cannot be empty")
        res = (sb.table("stores").update(clean)
               .eq("id", store["store_id"])
               .eq("organization_id", str(org_id)).execute())
        if not (res.data or []):
            raise NotFoundError("Store not found")
        audit_service.record(
            str(org_id), "store.settings", "store", store["store_id"],
            user_id=str(user.id), store_id=store["store_id"],
            metadata={k: clean[k] for k in sorted(clean)})
    got = (sb.table("stores").select("*").eq("id", store["store_id"])
           .maybe_single().execute())
    row = got.data if got and got.data else {}
    return SuccessResponse(
        data=StoreWithRole(**{**row, "role": store.get("role", "owner")}),
        message="Settings updated")
