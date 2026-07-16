"""Routes /users/me : profil, onboarding, mot de passe, avatar, suppression (CDC §4)."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, Response, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ibis.core.config import Settings, get_settings
from ibis.core.errors import NotFoundError
from ibis.db.engine import get_db
from ibis.modules.auth.deps import CurrentUser
from ibis.modules.auth.routes import _clear_refresh_cookie
from ibis.modules.auth.schemas import (
    AccountDeleteRequest,
    OnboardingRequest,
    PasswordChangeRequest,
    ProfileUpdateRequest,
    UserRead,
)
from ibis.modules.users import service
from ibis.storage import get_storage

router = APIRouter(prefix="/users", tags=["users"])

DbDep = Annotated[Session, Depends(get_db)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


@router.get("/me", response_model=UserRead, operation_id="getMe")
def get_me(user: CurrentUser) -> UserRead:
    return UserRead.model_validate(user)


@router.patch("/me", response_model=UserRead, operation_id="updateMe")
def update_me(payload: ProfileUpdateRequest, user: CurrentUser, db: DbDep) -> UserRead:
    return UserRead.model_validate(service.update_profile(db, user, payload))


@router.post("/me/onboarding", response_model=UserRead, operation_id="completeOnboarding")
def complete_onboarding(payload: OnboardingRequest, user: CurrentUser, db: DbDep) -> UserRead:
    return UserRead.model_validate(service.complete_onboarding(db, user, payload))


@router.patch("/me/password", status_code=204, operation_id="changePassword")
def change_password(payload: PasswordChangeRequest, user: CurrentUser, db: DbDep) -> None:
    service.change_password(
        db, user, current_password=payload.current_password, new_password=payload.new_password
    )


@router.put("/me/avatar", response_model=UserRead, operation_id="uploadAvatar")
async def upload_avatar(
    user: CurrentUser, db: DbDep, file: Annotated[UploadFile, File()]
) -> UserRead:
    content = await file.read(service.AVATAR_MAX_BYTES + 1)
    return UserRead.model_validate(service.save_avatar(db, user, content))


@router.get("/me/avatar", operation_id="getMyAvatar", response_class=StreamingResponse)
def get_my_avatar(user: CurrentUser) -> StreamingResponse:
    if not user.avatar_path or not get_storage().exists(user.avatar_path):
        raise NotFoundError("Aucun avatar", code="NO_AVATAR")
    return StreamingResponse(get_storage().stream(user.avatar_path), media_type="image/webp")


@router.post("/me/delete", status_code=204, operation_id="deleteAccount")
def delete_account(
    payload: AccountDeleteRequest,
    user: CurrentUser,
    db: DbDep,
    response: Response,
    settings: SettingsDep,
) -> None:
    """Suppression de compte (confirmation par email saisi) — cascade projets/expériences."""
    service.delete_account(db, user, email_confirmation=payload.email_confirmation)
    _clear_refresh_cookie(response, settings)
