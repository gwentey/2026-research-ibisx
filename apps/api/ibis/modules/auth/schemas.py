"""Schemas Pydantic auth & comptes — `extra="forbid"` sur toutes les écritures (ADR-007)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from ibis.modules.auth.models import EducationLevel, UserRole, XaiAudience

PASSWORD_MIN_LENGTH = 8


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RegisterRequest(StrictModel):
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=128)


class LoginRequest(StrictModel):
    email: EmailStr
    password: str = Field(max_length=128)


class ForgotPasswordRequest(StrictModel):
    email: EmailStr


class ResetPasswordRequest(StrictModel):
    token: str = Field(max_length=128)
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=128)


class GoogleExchangeRequest(StrictModel):
    code: str = Field(max_length=2048)
    state: str = Field(max_length=128)


class GoogleAuthorizeResponse(BaseModel):
    authorization_url: str
    state: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    role: UserRole
    is_active: bool
    pseudo: str | None
    given_name: str | None
    family_name: str | None
    locale: str
    education_level: EducationLevel | None
    age: int | None
    ai_familiarity: int | None
    xai_audience: XaiAudience
    credits: int
    has_password: bool
    has_avatar: bool
    onboarding_completed: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead


class OnboardingRequest(StrictModel):
    education_level: EducationLevel
    age: int = Field(ge=13, le=120)
    ai_familiarity: int = Field(ge=1, le=5)


class ProfileUpdateRequest(StrictModel):
    pseudo: str | None = Field(default=None, max_length=64)
    given_name: str | None = Field(default=None, max_length=120)
    family_name: str | None = Field(default=None, max_length=120)
    locale: str | None = None
    xai_audience: XaiAudience | None = None
    education_level: EducationLevel | None = None
    age: int | None = Field(default=None, ge=13, le=120)
    ai_familiarity: int | None = Field(default=None, ge=1, le=5)

    @field_validator("locale")
    @classmethod
    def locale_supported(cls, value: str | None) -> str | None:
        if value is not None and value not in ("fr", "en"):
            raise ValueError("locale must be 'fr' or 'en'")
        return value


class PasswordChangeRequest(StrictModel):
    current_password: str | None = Field(default=None, max_length=128)
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=128)


class AccountDeleteRequest(StrictModel):
    email_confirmation: EmailStr
