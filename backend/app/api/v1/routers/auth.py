from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user, oauth2_scheme
from app.core.errors import AppError
from app.core.security import create_access_token, decode_token, verify_password
from app.db.session import get_db
from app.models.token_blocklist import TokenBlocklistModel
from app.models.user import UserModel
from app.schemas.auth import LoginRequest, TokenResponse, UserBrief

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    result = await db.execute(select(UserModel).where(UserModel.username == payload.username))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise AppError(
            status.HTTP_401_UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid username or password."
        )
    if not user.is_active:
        raise AppError(
            status.HTTP_403_FORBIDDEN, "ACCOUNT_DISABLED", "This account has been disabled."
        )
    token, _jti, expires_at = create_access_token(user.id, user.role.value)
    return TokenResponse(
        access_token=token, expires_at=expires_at, user=UserBrief.model_validate(user)
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    current_user: UserModel = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> None:
    payload = decode_token(token)
    expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    db.add(TokenBlocklistModel(jti=payload["jti"], user_id=current_user.id, expires_at=expires_at))
    await db.commit()


@router.get("/me", response_model=UserBrief)
async def me(current_user: UserModel = Depends(get_current_user)) -> UserBrief:
    return UserBrief.model_validate(current_user)
