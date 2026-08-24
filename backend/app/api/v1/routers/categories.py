from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user, require_admin
from app.core.errors import AppError
from app.db.session import get_db
from app.models.category import CategoryModel
from app.models.product import ProductModel
from app.models.user import UserModel
from app.schemas.categories import CategoryCreate, CategoryOut, CategoryUpdate
from app.schemas.common import Paginated

router = APIRouter(prefix="/categories", tags=["categories"])


async def _get_category_or_404(db: AsyncSession, category_id: int) -> CategoryModel:
    category = await db.get(CategoryModel, category_id)
    if category is None:
        raise AppError(404, "CATEGORY_NOT_FOUND", f"Category {category_id} does not exist.")
    return category


@router.get("", response_model=Paginated[CategoryOut])
async def list_categories(
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Paginated[CategoryOut]:
    stmt = select(CategoryModel)
    count_stmt = select(func.count()).select_from(CategoryModel)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(CategoryModel.name.ilike(like))
        count_stmt = count_stmt.where(CategoryModel.name.ilike(like))
    total = await db.scalar(count_stmt)
    offset = (page - 1) * page_size
    rows = await db.scalars(stmt.order_by(CategoryModel.name).offset(offset).limit(page_size))
    return Paginated.build(list(rows), page, page_size, int(total or 0))


@router.post("", response_model=CategoryOut, status_code=201)
async def create_category(
    payload: CategoryCreate,
    admin: UserModel = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> CategoryOut:
    existing = await db.scalar(select(CategoryModel).where(CategoryModel.name == payload.name))
    if existing is not None:
        raise AppError(409, "CATEGORY_EXISTS", f"Category '{payload.name}' already exists.")
    category = CategoryModel(**payload.model_dump())
    db.add(category)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise AppError(409, "CATEGORY_EXISTS", f"Category '{payload.name}' already exists.")
    await db.refresh(category)
    return CategoryOut.model_validate(category)


@router.put("/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: int,
    payload: CategoryUpdate,
    admin: UserModel = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> CategoryOut:
    category = await _get_category_or_404(db, category_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise AppError(409, "CATEGORY_EXISTS", "A category with this name already exists.")
    await db.refresh(category)
    return CategoryOut.model_validate(category)


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: int,
    admin: UserModel = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    category = await _get_category_or_404(db, category_id)
    in_use = await db.scalar(
        select(func.count()).select_from(ProductModel).where(ProductModel.category_id == category_id)
    )
    if int(in_use or 0) > 0:
        raise AppError(
            409,
            "CATEGORY_IN_USE",
            f"Category '{category.name}' still has products assigned. Reassign them first.",
        )
    await db.delete(category)
    await db.commit()
