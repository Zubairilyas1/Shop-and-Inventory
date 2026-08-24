import uuid

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.security import decode_token
from app.db.session import get_db
from app.models.token_blocklist import TokenBlocklistModel
from app.models.user import UserModel, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

credentials_error = AppError(401, "UNAUTHORIZED", "Invalid or expired session token.")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> UserModel:
    try:
        payload = decode_token(token)
    except Exception:
        raise credentials_error

    jti_raw = payload.get("jti")
    user_id_raw = payload.get("sub")
    if not jti_raw or not user_id_raw:
        raise credentials_error
    try:
        jti = uuid.UUID(str(jti_raw))
        user_id = int(user_id_raw)
    except (ValueError, TypeError):
        raise credentials_error

    revoked = await db.get(TokenBlocklistModel, jti)
    if revoked is not None:
        raise credentials_error

    user = await db.get(UserModel, user_id)
    if user is None or not user.is_active:
        raise credentials_error
    return user


async def require_admin(user: UserModel = Depends(get_current_user)) -> UserModel:
    if user.role != UserRole.admin:
        raise AppError(403, "FORBIDDEN", "Admin privileges are required for this action.")
    return user
