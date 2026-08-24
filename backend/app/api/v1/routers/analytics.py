from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.core.errors import AppError
from app.db.session import get_db
from app.models.user import UserModel

router = APIRouter(prefix="/analytics", tags=["analytics"])

GROUP_BY_MAP = {"day": "day", "week": "week", "month": "month"}


def _default_range(
    start_date: date | None, end_date: date | None
) -> tuple[datetime, datetime]:
    start = start_date or (date.today() - timedelta(days=30))
    end = end_date or date.today()
    return (
        datetime.combine(start, time.min),
        datetime.combine(end, time.max),
    )


@router.get("/dashboard")
async def dashboard(
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    today_revenue, today_profit, items_sold_today, total_products, low_stock_count, inventory_value = (
        None,
        None,
        None,
        None,
        None,
        None,
    )

    row = (
        await db.execute(
            text(
                "SELECT COALESCE(SUM(total_revenue), 0), COALESCE(SUM(total_profit), 0) "
                "FROM sales WHERE sale_date >= DATE_TRUNC('day', NOW())"
            )
        )
    ).one()
    today_revenue, today_profit = float(row[0]), float(row[1])

    items_sold_today = int(
        (
            await db.execute(
                text(
                    "SELECT COALESCE(SUM(si.quantity), 0) FROM sale_items si "
                    "JOIN sales s ON s.id = si.sale_id "
                    "WHERE s.sale_date >= DATE_TRUNC('day', NOW())"
                )
            )
        ).scalar_one()
    )

    total_products = int(
        (
            await db.execute(
                text("SELECT COUNT(*) FROM products WHERE is_archived = FALSE")
            )
        ).scalar_one()
    )

    low_stock_count = int(
        (
            await db.execute(
                text(
                    "SELECT COUNT(*) FROM products "
                    "WHERE is_archived = FALSE AND current_stock <= min_stock_alert"
                )
            )
        ).scalar_one()
    )

    inventory_value = float(
        (
            await db.execute(
                text(
                    "SELECT COALESCE(SUM(current_stock * buying_price), 0) FROM products "
                    "WHERE is_archived = FALSE"
                )
            )
        ).scalar_one()
    )

    return {
        "today_sales": today_revenue,
        "today_profit": today_profit,
        "items_sold_today": items_sold_today,
        "total_products": total_products,
        "low_stock_count": low_stock_count,
        "inventory_value": inventory_value,
    }


@router.get("/trends")
async def trends(
    group_by: str = Query("day"),
    start_date: date | None = None,
    end_date: date | None = None,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    if group_by not in GROUP_BY_MAP:
        raise AppError(400, "UNKNOWN_GROUP_BY", "group_by must be day, week or month.")
    start, end = _default_range(start_date, end_date)

    result = await db.execute(
        text(
            "SELECT DATE_TRUNC(:grp, sale_date)::date AS bucket, "
            "SUM(total_revenue) AS revenue, SUM(total_cost) AS cost, "
            "SUM(total_profit) AS profit, COUNT(*) AS transactions "
            "FROM sales WHERE sale_date BETWEEN :start AND :end "
            "GROUP BY 1 ORDER BY 1"
        ),
        {"grp": GROUP_BY_MAP[group_by], "start": start, "end": end},
    )
    return [
        {
            "bucket": str(row.bucket),
            "revenue": float(row.revenue or 0),
            "cost": float(row.cost or 0),
            "profit": float(row.profit or 0),
            "transactions": int(row.transactions),
        }
        for row in result
    ]


@router.get("/top-products")
async def top_products(
    limit: int = Query(5, ge=1, le=20),
    metric: str = Query("quantity"),
    start_date: date | None = None,
    end_date: date | None = None,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    if metric not in ("quantity", "revenue"):
        raise AppError(400, "UNKNOWN_METRIC", "metric must be 'quantity' or 'revenue'.")
    order_column = "units_sold" if metric == "quantity" else "revenue"
    start, end = _default_range(start_date, end_date)

    result = await db.execute(
        text(
            "SELECT p.id, p.sku_code, p.name, SUM(si.quantity) AS units_sold, "
            "SUM(si.line_revenue) AS revenue, SUM(si.line_profit) AS profit "
            "FROM sale_items si "
            "JOIN products p ON p.id = si.product_id "
            "JOIN sales s ON s.id = si.sale_id "
            "WHERE s.sale_date BETWEEN :start AND :end "
            f"GROUP BY p.id, p.sku_code, p.name ORDER BY {order_column} DESC LIMIT :limit"
        ),
        {"start": start, "end": end, "limit": limit},
    )
    return [
        {
            "id": row.id,
            "sku_code": row.sku_code,
            "name": row.name,
            "units_sold": int(row.units_sold),
            "revenue": float(row.revenue or 0),
            "profit": float(row.profit or 0),
        }
        for row in result
    ]


@router.get("/category-revenue")
async def category_revenue(
    start_date: date | None = None,
    end_date: date | None = None,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    start, end = _default_range(start_date, end_date)
    result = await db.execute(
        text(
            "SELECT c.id, c.name, SUM(si.line_revenue) AS revenue, "
            "ROUND(SUM(si.line_revenue) * 100.0 / NULLIF(SUM(SUM(si.line_revenue)) OVER (), 0), 2) AS share_pct "
            "FROM sale_items si "
            "JOIN products p ON p.id = si.product_id "
            "JOIN categories c ON c.id = p.category_id "
            "JOIN sales s ON s.id = si.sale_id "
            "WHERE s.sale_date BETWEEN :start AND :end "
            "GROUP BY c.id, c.name ORDER BY revenue DESC"
        ),
        {"start": start, "end": end},
    )
    return [
        {
            "id": row.id,
            "name": row.name,
            "revenue": float(row.revenue or 0),
            "share_pct": float(row.share_pct or 0),
        }
        for row in result
    ]
