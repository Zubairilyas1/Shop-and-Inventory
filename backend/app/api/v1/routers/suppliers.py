from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user, require_admin
from app.core.errors import AppError
from app.db.session import get_db
from app.models.supplier import SupplierModel
from app.models.user import UserModel
from app.schemas.common import Paginated
from app.schemas.suppliers import SupplierCreate, SupplierOut, SupplierUpdate

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


async def _get_supplier_or_404(db: AsyncSession, supplier_id: int) -> SupplierModel:
    supplier = await db.get(SupplierModel, supplier_id)
    if supplier is None:
        raise AppError(404, "SUPPLIER_NOT_FOUND", f"Supplier {supplier_id} does not exist.")
    return supplier


@router.get("", response_model=Paginated[SupplierOut])
async def list_suppliers(
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Paginated[SupplierOut]:
    stmt = select(SupplierModel)
    count_stmt = select(func.count()).select_from(SupplierModel)
    if q:
        like = f"%{q}%"
        condition = or_(SupplierModel.name.ilike(like), SupplierModel.contact_info.ilike(like))
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)
    total = await db.scalar(count_stmt)
    offset = (page - 1) * page_size
    rows = await db.scalars(stmt.order_by(SupplierModel.name).offset(offset).limit(page_size))
    return Paginated.build(list(rows), page, page_size, int(total or 0))


@router.post("", response_model=SupplierOut, status_code=201)
async def create_supplier(
    payload: SupplierCreate,
    admin: UserModel = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> SupplierOut:
    supplier = SupplierModel(**payload.model_dump())
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return SupplierOut.model_validate(supplier)


@router.put("/{supplier_id}", response_model=SupplierOut)
async def update_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    admin: UserModel = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> SupplierOut:
    supplier = await _get_supplier_or_404(db, supplier_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(supplier, field, value)
    await db.commit()
    await db.refresh(supplier)
    return SupplierOut.model_validate(supplier)


@router.delete("/{supplier_id}", status_code=204)
async def delete_supplier(
    supplier_id: int,
    admin: UserModel = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        text("SELECT COUNT(*) FROM purchases WHERE supplier_id = :sid"),
        {"sid": supplier_id},
    )
    purchase_count = int(result.scalar_one() or 0)
    if purchase_count > 0:
        raise AppError(
            409,
            "SUPPLIER_IN_USE",
            "Supplier has purchase history and cannot be deleted.",
        )
    supplier = await _get_supplier_or_404(db, supplier_id)
    await db.delete(supplier)
    await db.commit()
