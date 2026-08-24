import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.user import UserRole

PASSWORD_PATTERN = re.compile(r"^(?=.*[A-Za-z])(?=.*\d)\S{8,72}$")


def validate_password_strength(value: str) -> str:
    if not PASSWORD_PATTERN.match(value):
        raise ValueError(
            "Password must be 8-72 characters and contain at least one letter and one digit."
        )
    return value


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str
    full_name: str | None = Field(default=None, max_length=150)
    role: UserRole = UserRole.manager

    @field_validator("password")
    @classmethod
    def password_ok(cls, value: str) -> str:
        return validate_password_strength(value)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=150)
    password: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None

    @field_validator("password")
    @classmethod
    def password_ok(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_password_strength(value)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str | None
    role: UserRole
    is_active: bool
    created_at: datetime
