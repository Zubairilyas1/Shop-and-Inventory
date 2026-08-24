from datetime import date, datetime, time, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.deps import get_current_user
from app.core.errors import AppError
from app.db.session import get_db
from app.models.product import ProductModel
from app.models.sale import SaleModel
from app.models.sale_item import SaleItemModel
from app.models.user import UserModel
from app.schemas.common import Paginated
from app.schemas.sales import CheckoutRequest, CheckoutResponse, SaleDetailOut, SaleOut
from app.services.pdf_service import build_receipt_pdf

router = APIRouter(prefix="/sales", tags=["sales"])


def _resolve_day_boundaries(
    start_date: date | None, end_date: date | None
) -> tuple[datetime | None, datetime | None]:
    start = (
        datetime.combine(start_date, time.min, tzinfo=timezone.utc) if start_date else None
    )
    end = datetime.combine(end_date, time.max, tzinfo=timezone.utc) if end_date else None
    return start, end


async def _generate_transaction_code(db: AsyncSession) -> str:
    result = await db.execute(
        text(
            "SELECT 'TRX-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' "
            "|| LPAD(NEXTVAL('transaction_code_seq')::TEXT, 4, '0')"
        )
    )
    return str(result.scalar_one())


async def _load_product_names(
    db: AsyncSession, product_ids: list[int]
) -> dict[int, tuple[str, str]]:
    if not product_ids:
        return {}
    rows = await db.execute(
        select(ProductModel.id, ProductModel.name, ProductModel.sku_code).where(
            ProductModel.id.in_(product_ids)
        )
    )
    return {row[0]: (row[1], row[2]) for row in rows.all()}


@router.post("/checkout", response_model=CheckoutResponse, status_code=201)
async def checkout(
    payload: CheckoutRequest,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckoutResponse:
    product_ids = sorted({item.product_id for item in payload.items})

    locked_rows = await db.scalars(
        select(ProductModel)
        .where(ProductModel.id.in_(product_ids))
        .order_by(ProductModel.id)
        .with_for_update()
    )
    products_by_id: dict[int, ProductModel] = {p.id: p for p in locked_rows}

    shortages: list[dict] = []
    for item in payload.items:
        product = products_by_id.get(item.product_id)
        if product is None:
            raise AppError(404, "PRODUCT_NOT_FOUND", f"Product {item.product_id} does not exist.")
        if item.quantity > product.current_stock:
            shortages.append(
                {
                    "product_id": product.id,
                    "sku_code": product.sku_code,
                    "available": product.current_stock,
                }
            )
    if shortages:
        raise AppError(
            409,
            "INSUFFICIENT_STOCK",
            "One or more items exceed available stock.",
            details=shortages,
        )

    total_revenue = Decimal("0.00")
    total_cost = Decimal("0.00")
    line_values: list[dict] = []
    for item in payload.items:
        product = products_by_id[item.product_id]
        unit_buying = Decimal(str(product.buying_price))
        unit_selling = Decimal(str(product.selling_price))
        line_revenue = (unit_selling * item.quantity).quantize(Decimal("0.01"))
        line_cost = (unit_buying * item.quantity).quantize(Decimal("0.01"))
        line_profit = line_revenue - line_cost
        total_revenue += line_revenue
        total_cost += line_cost
        line_values.append(
            {
                "product": product,
                "quantity": item.quantity,
                "unit_buying_price": unit_buying,
                "unit_selling_price": unit_selling,
                "line_revenue": line_revenue,
                "line_profit": line_profit,
            }
        )
    total_profit = total_revenue - total_cost

    transaction_code = await _generate_transaction_code(db)
    sale = SaleModel(
        transaction_code=transaction_code,
        customer_name=payload.customer_name,
        total_revenue=total_revenue,
        total_cost=total_cost,
        total_profit=total_profit,
        sold_by=current_user.id,
    )
    db.add(sale)

    for values in line_values:
        sale.items.append(
            SaleItemModel(
                product_id=values["product"].id,
                quantity=values["quantity"],
                unit_buying_price=values["unit_buying_price"],
                unit_selling_price=values["unit_selling_price"],
                line_revenue=values["line_revenue"],
                line_profit=values["line_profit"],
            )
        )
        product: ProductModel = values["product"]
        product.current_stock -= values["quantity"]

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise AppError(500, "CHECKOUT_FAILED", "Sale could not be completed. Please retry.")

    await db.refresh(sale)
    return CheckoutResponse.model_validate(SaleDetailOut.model_validate(sale))


async def _get_sale_or_404(db: AsyncSession, sale_id: int) -> SaleModel:
    stmt = (
        select(SaleModel)
        .options(selectinload(SaleModel.items))
        .where(SaleModel.id == sale_id)
    )
    sale = await db.scalar(stmt)
    if sale is None:
        raise AppError(404, "SALE_NOT_FOUND", f"Sale {sale_id} does not exist.")
    return sale


@router.get("", response_model=Paginated[SaleOut])
async def list_sales(
    q: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Paginated[SaleOut]:
    conditions = []
    start, end = _resolve_day_boundaries(start_date, end_date)
    if start is not None:
        conditions.append(SaleModel.sale_date >= start)
    if end is not None:
        conditions.append(SaleModel.sale_date <= end)
    if q:
        like = f"%{q}%"
        conditions.append(
            SaleModel.transaction_code.ilike(like) | SaleModel.customer_name.ilike(like)
        )

    count_stmt = select(func.count()).select_from(SaleModel).where(*conditions)
    total = await db.scalar(count_stmt)

    offset = (page - 1) * page_size
    stmt = (
        select(SaleModel)
        .where(*conditions)
        .order_by(SaleModel.sale_date.desc(), SaleModel.id.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = await db.scalars(stmt)
    items = [SaleOut.model_validate(row) for row in rows]
    return Paginated.build(items, page, page_size, int(total or 0))


@router.get("/{sale_id}", response_model=SaleDetailOut)
async def get_sale(
    sale_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SaleDetailOut:
    sale = await _get_sale_or_404(db, sale_id)
    out = SaleDetailOut.model_validate(sale)
    names = await _load_product_names(db, [item.product_id for item in sale.items])
    for item_out, item_model in zip(out.items, sale.items):
        name, sku = names.get(item_model.product_id, (None, None))
        item_out.product_name = name
        item_out.product_sku = sku
    return out


@router.get("/{sale_id}/pdf")
async def get_sale_pdf(
    sale_id: int,
    layout: str = "a4",
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    if layout not in ("a4", "thermal80"):
        raise AppError(400, "UNKNOWN_LAYOUT", "layout must be 'a4' or 'thermal80'.")
    sale = await _get_sale_or_404(db, sale_id)
    catalog = await _load_product_names(db, [item.product_id for item in sale.items])

    lines = [
        {
            "name": catalog.get(item.product_id, ("-", "-"))[0],
            "sku_code": catalog.get(item.product_id, ("-", "-"))[1],
            "quantity": item.quantity,
            "unit_selling_price": item.unit_selling_price,
            "line_revenue": item.line_revenue,
        }
        for item in sorted(sale.items, key=lambda i: i.id)
    ]

    cashier = None
    if sale.sold_by is not None:
        cashier_row = await db.get(UserModel, sale.sold_by)
        cashier = cashier_row.username if cashier_row else None

    pdf_bytes = build_receipt_pdf(
        transaction_code=sale.transaction_code,
        sale_date=sale.sale_date.strftime("%Y-%m-%d %H:%M UTC"),
        customer_name=sale.customer_name or "Walk-in Customer",
        cashier=cashier,
        lines=lines,
        total_revenue=sale.total_revenue,
        total_cost=sale.total_cost,
        total_profit=sale.total_profit,
    )
    safe_customer = (sale.customer_name or "Walkin").replace(" ", "")
    filename = f"Invoice_{safe_customer}_{sale.transaction_code}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
