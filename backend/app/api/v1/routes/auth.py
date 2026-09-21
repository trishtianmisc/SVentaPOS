"""Auth routes. Supabase Auth is IdP; FastAPI resolves context."""
from fastapi import APIRouter, Depends

from app.api.v1.dependencies import CurrentUser, get_current_user
from app.schemas.auth import MeResponse, MeStore
from app.schemas.common import SuccessResponse

router = APIRouter()


@router.get(
    "/me",
    response_model=SuccessResponse[MeResponse],
    summary="Current user + org/store context",
)
def me(user: CurrentUser = Depends(get_current_user)):
    return SuccessResponse(
        data=MeResponse(
            user_id=user.id,
            email=user.email,
            organization_id=user.organization_id,
            full_name=user.full_name,
            stores=[
                MeStore(store_id=s["store_id"], role=s["role"])
                for s in user.stores
                if "store_id" in s
            ],
        )
    )


@router.post("/logout", response_model=SuccessResponse[dict], summary="Client logout ack")
def logout():
    # Supabase client clears session; server just acks for consistent envelope.
    return SuccessResponse(data={}, message="Logged out")
