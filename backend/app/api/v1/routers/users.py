from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import require_admin
from app.core.errors import AppError
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import UserModel
from app.schemas.common import Paginated
from app.schemas.users import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_admin)])


async def _get_user_or_404(db: AsyncSession, user_id: int) -> UserModel:
    user = await db.get(UserModel, user_id)
    if user is None:
        raise AppError(404, "USER_NOT_FOUND", f"User {user_id} does not exist.")
    return user


@router.get("", response_model=Paginated[UserOut])
async def list_users(
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> Paginated[UserOut]:
    stmt = select(UserModel)
    count_stmt = select(func.count()).select_from(UserModel)
    if q:
        like = f"%{q}%"
        condition = or_(UserModel.username.ilike(like), UserModel.full_name.ilike(like))
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)
    total = await db.scalar(count_stmt)
    offset = (page - 1) * page_size
    rows = await db.scalars(stmt.order_by(UserModel.id).offset(offset).limit(page_size))
    return Paginated.build(list(rows), page, page_size, int(total or 0))


@router.post("", response_model=UserOut, status_code=201)
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)) -> UserModel:
    existing = await db.scalar(select(UserModel).where(UserModel.username == payload.username))
    if existing is not None:
        raise AppError(409, "USERNAME_TAKEN", f"Username '{payload.username}' already exists.")
    user = UserModel(
        username=payload.username,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int, payload: UserUpdate, db: AsyncSession = Depends(get_db)
) -> UserModel:
    user = await _get_user_or_404(db, user_id)
    data = payload.model_dump(exclude_unset=True)
    if "password" in data and data["password"] is not None:
        data["password_hash"] = hash_password(data.pop("password"))
    for field, value in data.items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", response_model=UserOut)
async def disable_user(user_id: int, db: AsyncSession = Depends(get_db)) -> UserModel:
    user = await _get_user_or_404(db, user_id)
    user.is_active = False
    await db.commit()
    await db.refresh(user)
    return user
