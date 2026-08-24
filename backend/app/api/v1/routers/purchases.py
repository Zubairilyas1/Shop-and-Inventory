from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.core.errors import AppError
from app.db.session import get_db
from app.models.product import ProductModel
from app.models.purchase import PurchaseModel
from app.models.supplier import SupplierModel
from app.models.user import UserModel
from app.schemas.common import Paginated
from app.schemas.purchases import PurchaseCreate, PurchaseOut

router = APIRouter(prefix="/purchases", tags=["purchases"])


def _resolve_day_boundaries(
    start_date: date | None, end_date: date | None
) -> tuple[datetime | None, datetime | None]:
    start = (
        datetime.combine(start_date, time.min, tzinfo=timezone.utc) if start_date else None
    )
    end = datetime.combine(end_date, time.max, tzinfo=timezone.utc) if end_date else None
    return start, end


@router.post("", response_model=PurchaseOut, status_code=201)
async def create_purchase(
    payload: PurchaseCreate,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PurchaseOut:
    product = await db.get(ProductModel, payload.product_id)
    if product is None:
        raise AppError(404, "PRODUCT_NOT_FOUND", f"Product {payload.product_id} does not exist.")
    supplier = await db.get(SupplierModel, payload.supplier_id)
    if supplier is None:
        raise AppError(404, "SUPPLIER_NOT_FOUND", f"Supplier {payload.supplier_id} does not exist.")

    total_cost = payload.unit_buying_price * payload.quantity
    purchase = PurchaseModel(
        product_id=payload.product_id,
        supplier_id=payload.supplier_id,
        quantity=payload.quantity,
        unit_buying_price=payload.unit_buying_price,
        total_cost=total_cost,
        invoice_number=payload.invoice_number,
    )
    db.add(purchase)
    product.current_stock += payload.quantity
    await db.commit()
    await db.refresh(purchase)
    return PurchaseOut.model_validate(purchase)


@router.get("", response_model=Paginated[PurchaseOut])
async def list_purchases(
    start_date: date | None = None,
    end_date: date | None = None,
    supplier_id: int | None = None,
    product_id: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Paginated[PurchaseOut]:
    conditions = []
    start, end = _resolve_day_boundaries(start_date, end_date)
    if start is not None:
        conditions.append(PurchaseModel.purchase_date >= start)
    if end is not None:
        conditions.append(PurchaseModel.purchase_date <= end)
    if supplier_id is not None:
        conditions.append(PurchaseModel.supplier_id == supplier_id)
    if product_id is not None:
        conditions.append(PurchaseModel.product_id == product_id)

    count_stmt = select(func.count()).select_from(PurchaseModel).where(*conditions)
    total = await db.scalar(count_stmt)

    offset = (page - 1) * page_size
    stmt = (
        select(PurchaseModel)
        .where(*conditions)
        .order_by(PurchaseModel.purchase_date.desc(), PurchaseModel.id.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = await db.scalars(stmt)
    return Paginated.build(list(rows), page, page_size, int(total or 0))
