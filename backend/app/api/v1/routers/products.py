from fastapi import APIRouter, Depends, Query
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.deps import get_current_user, require_admin
from app.core.errors import AppError
from app.db.session import get_db
from app.models.category import CategoryModel
from app.models.product import ProductModel
from app.models.supplier import SupplierModel
from app.models.user import UserModel
from app.schemas.common import Paginated
from app.schemas.products import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])

SORT_MAP = {
    "name": asc(ProductModel.name),
    "-created_at": desc(ProductModel.created_at),
    "current_stock": asc(ProductModel.current_stock),
}


async def _get_product_or_404(db: AsyncSession, product_id: int) -> ProductModel:
    stmt = (
        select(ProductModel)
        .options(selectinload(ProductModel.category), selectinload(ProductModel.supplier))
        .where(ProductModel.id == product_id)
    )
    product = await db.scalar(stmt)
    if product is None:
        raise AppError(404, "PRODUCT_NOT_FOUND", f"Product {product_id} does not exist.")
    return product


async def _validate_foreign_keys(
    db: AsyncSession, category_id: int | None, supplier_id: int | None
) -> None:
    if category_id is not None:
        category = await db.get(CategoryModel, category_id)
        if category is None:
            raise AppError(422, "CATEGORY_NOT_FOUND", f"Category {category_id} does not exist.")
    if supplier_id is not None:
        supplier = await db.get(SupplierModel, supplier_id)
        if supplier is None:
            raise AppError(422, "SUPPLIER_NOT_FOUND", f"Supplier {supplier_id} does not exist.")


@router.get("", response_model=Paginated[ProductOut])
async def list_products(
    q: str | None = None,
    category_id: int | None = None,
    supplier_id: int | None = None,
    low_stock: bool = False,
    include_archived: bool = False,
    sort: str = "-created_at",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Paginated[ProductOut]:
    order_by = SORT_MAP.get(sort)
    if order_by is None:
        raise AppError(400, "UNKNOWN_SORT", f"sort must be one of: {', '.join(SORT_MAP)}.")

    conditions = []
    if not include_archived:
        conditions.append(ProductModel.is_archived.is_(False))
    if q:
        like = f"%{q}%"
        conditions.append(
            or_(ProductModel.name.ilike(like), ProductModel.sku_code.ilike(like))
        )
    if category_id is not None:
        conditions.append(ProductModel.category_id == category_id)
    if supplier_id is not None:
        conditions.append(ProductModel.supplier_id == supplier_id)
    if low_stock:
        conditions.append(ProductModel.current_stock <= ProductModel.min_stock_alert)

    count_stmt = select(func.count()).select_from(ProductModel).where(*conditions)
    total = await db.scalar(count_stmt)

    offset = (page - 1) * page_size
    stmt = (
        select(ProductModel)
        .options(selectinload(ProductModel.category), selectinload(ProductModel.supplier))
        .where(*conditions)
        .order_by(order_by, asc(ProductModel.id))
        .offset(offset)
        .limit(page_size)
    )
    rows = await db.scalars(stmt)
    items = [ProductOut.model_validate(row) for row in rows]
    return Paginated.build(items, page, page_size, int(total or 0))


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(
    product_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProductOut:
    product = await _get_product_or_404(db, product_id)
    return ProductOut.model_validate(product)


@router.post("", response_model=ProductOut, status_code=201)
async def create_product(
    payload: ProductCreate,
    admin: UserModel = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ProductOut:
    await _validate_foreign_keys(db, payload.category_id, payload.supplier_id)
    existing = await db.scalar(select(ProductModel).where(ProductModel.sku_code == payload.sku_code))
    if existing is not None:
        raise AppError(409, "SKU_TAKEN", f"SKU '{payload.sku_code}' already exists.")
    product = ProductModel(**payload.model_dump())
    db.add(product)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise AppError(409, "SKU_TAKEN", f"SKU '{payload.sku_code}' already exists.")
    await db.refresh(product, attribute_names=["category", "supplier"])
    return ProductOut.model_validate(product)


@router.put("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: int,
    payload: ProductUpdate,
    admin: UserModel = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ProductOut:
    product = await _get_product_or_404(db, product_id)
    data = payload.model_dump(exclude_unset=True)
    buying = data.get("buying_price", product.buying_price)
    selling = data.get("selling_price", product.selling_price)
    if selling < buying:
        raise AppError(
            422,
            "PRICE_INVALID",
            "selling_price must be greater than or equal to buying_price.",
        )
    await _validate_foreign_keys(db, data.get("category_id"), data.get("supplier_id"))
    for field, value in data.items():
        setattr(product, field, value)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise AppError(409, "PRODUCT_UPDATE_CONFLICT", "Product update violated a constraint.")
    await db.refresh(product, attribute_names=["category", "supplier"])
    return ProductOut.model_validate(product)


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: int,
    admin: UserModel = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    product = await _get_product_or_404(db, product_id)
    try:
        await db.delete(product)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise AppError(
            409,
            "PRODUCT_IN_USE",
            "Product has sales or purchase history. Archive it instead.",
        )
