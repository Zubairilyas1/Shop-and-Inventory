import datetime as dt

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.core.errors import AppError
from app.db.session import get_db
from app.models.user import UserModel
from app.services.pdf_service import build_tabular_pdf
from app.services.report_service import build_csv, build_xlsx

router = APIRouter(prefix="/reports", tags=["reports"])

REPORT_TYPES = ("sales", "inventory", "purchases", "profitability")
EXPORT_FORMATS = ("csv", "xlsx", "pdf")
MAX_RANGE_DAYS = 366

REPORT_QUERIES: dict[str, dict] = {
    "sales": {
        "title": "Sales Report",
        "headers": ["Transaction Code", "Date", "Customer", "Revenue (Rs.)", "Cost (Rs.)", "Profit (Rs.)"],
        "sql": (
            "SELECT transaction_code, TO_CHAR(sale_date, 'YYYY-MM-DD HH24:MI'), "
            "COALESCE(customer_name, 'Walk-in Customer'), total_revenue, total_cost, total_profit "
            "FROM sales WHERE sale_date BETWEEN :start AND :end "
            "ORDER BY sale_date DESC"
        ),
        "grand_total_column": 3,
    },
    "inventory": {
        "title": "Inventory Report",
        "headers": ["SKU", "Product", "Category", "Stock", "Min Alert", "Buying Price", "Selling Price", "Valuation (Rs.)", "Status"],
        "sql": (
            "SELECT p.sku_code, p.name, c.name, p.current_stock, p.min_stock_alert, "
            "p.buying_price, p.selling_price, p.current_stock * p.buying_price, "
            "CASE WHEN p.current_stock = 0 THEN 'OUT' "
            "WHEN p.current_stock <= p.min_stock_alert THEN 'LOW' ELSE 'OK' END "
            "FROM products p JOIN categories c ON c.id = p.category_id "
            "WHERE p.is_archived = FALSE ORDER BY p.name"
        ),
        "grand_total_column": None,
    },
    "purchases": {
        "title": "Purchases Report",
        "headers": ["Date", "Invoice #", "Supplier", "Quantity", "Unit Cost (Rs.)", "Total Cost (Rs.)"],
        "sql": (
            "SELECT TO_CHAR(pu.purchase_date, 'YYYY-MM-DD HH24:MI'), pu.invoice_number, s.name, "
            "pu.quantity, pu.unit_buying_price, pu.total_cost "
            "FROM purchases pu JOIN suppliers s ON s.id = pu.supplier_id "
            "WHERE pu.purchase_date BETWEEN :start AND :end "
            "ORDER BY pu.purchase_date DESC"
        ),
        "grand_total_column": 5,
    },
    "profitability": {
        "title": "Profitability Report",
        "headers": ["Day", "Transactions", "Revenue (Rs.)", "Cost (Rs.)", "Profit (Rs.)"],
        "sql": (
            "SELECT TO_CHAR(DATE_TRUNC('day', sale_date), 'YYYY-MM-DD'), COUNT(*), "
            "SUM(total_revenue), SUM(total_cost), SUM(total_profit) "
            "FROM sales WHERE sale_date BETWEEN :start AND :end "
            "GROUP BY 1 ORDER BY 1 DESC"
        ),
        "grand_total_column": 2,
    },
}


def _money(value) -> str:
    return f"{float(value or 0):,.2f}"


@router.get("/export")
async def export_report(
    type: str = Query(..., description="sales | inventory | purchases | profitability"),
    format: str = Query("csv"),
    start_date: dt.date | None = None,
    end_date: dt.date | None = None,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    if type not in REPORT_TYPES:
        raise AppError(400, "UNKNOWN_REPORT_TYPE", f"type must be one of {REPORT_TYPES}.")
    if format not in EXPORT_FORMATS:
        raise AppError(400, "UNKNOWN_FORMAT", f"format must be one of {EXPORT_FORMATS}.")

    end = end_date or dt.date.today()
    start = start_date or (end - dt.timedelta(days=30))
    if start > end:
        raise AppError(400, "INVALID_RANGE", "start_date must be on or before end_date.")
    if end > dt.date.today():
        raise AppError(400, "INVALID_RANGE", "end_date cannot be in the future.")
    if (end - start).days > MAX_RANGE_DAYS:
        raise AppError(400, "RANGE_TOO_LARGE", "Report range is capped at 366 days.")

    spec = REPORT_QUERIES[type]
    start_ts = dt.datetime.combine(start, dt.time.min)
    end_ts = dt.datetime.combine(end, dt.time.max)

    result = await db.execute(text(spec["sql"]), {"start": start_ts, "end": end_ts})
    raw_rows = result.all()

    headers = list(spec["headers"])
    rows: list[list[str]] = []
    for row in raw_rows:
        cells = [str(value) for value in row]
        for index, header in enumerate(headers):
            if "(Rs.)" in header and index < len(cells):
                cells[index] = _money(row[index])
        rows.append(cells)

    grand_total_column = spec["grand_total_column"]
    has_totals = grand_total_column is not None
    totals_cells: list[str] | None = None
    if has_totals:
        numeric_columns = [i for i, h in enumerate(headers) if "(Rs.)" in h]
        totals = [0.0] * len(numeric_columns)
        for row in raw_rows:
            for offset, col in enumerate(numeric_columns):
                totals[offset] += float(row[col] or 0)
        totals_cells = [""] * len(headers)
        totals_cells[0] = "GRAND TOTAL"
        for offset, col in enumerate(numeric_columns):
            totals_cells[col] = _money(totals[offset])

    subtitle = f"{type.capitalize()} report from {start.isoformat()} to {end.isoformat()}"
    base_name = f"{type}_report_{start.isoformat()}_{end.isoformat()}"

    if format == "csv":
        all_rows = rows + ([totals_cells] if totals_cells else [])
        content = build_csv(headers, all_rows)
    elif format == "xlsx":
        all_rows = rows + ([totals_cells] if totals_cells else [])
        content = build_xlsx(spec["title"], headers, all_rows)
    else:
        pdf_rows = [row[: len(headers)] for row in rows]
        content = build_tabular_pdf(spec["title"], subtitle, headers, pdf_rows)

    media_types = {
        "csv": "text/csv; charset=utf-8",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "pdf": "application/pdf",
    }
    return Response(
        content=content,
        media_type=media_types[format],
        headers={
            "Content-Disposition": f'attachment; filename="{base_name}.{format}"',
            "Content-Length": str(len(content)),
        },
    )
