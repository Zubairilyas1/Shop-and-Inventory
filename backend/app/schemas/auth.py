from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.user import UserRole


class LoginRequest(BaseModel):
    username: str
    password: str


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str | None
    role: UserRole
    is_active: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserBrief
