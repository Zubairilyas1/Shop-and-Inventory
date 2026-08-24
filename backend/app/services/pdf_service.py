import io
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

SHOP_NAME = "Centralized Shop"
SHOP_ADDRESS = "Main Bazaar Road"
SHOP_PHONE = "+92 300 0000000"

HEADER_BG = colors.HexColor("#1e293b")
ZEBRA_BG = colors.HexColor("#f1f5f9")


def _styles() -> dict:
    base = getSampleStyleSheet()
    return {
        "shop": ParagraphStyle(
            "ShopName", parent=base["Title"], fontSize=20, textColor=HEADER_BG, spaceAfter=2
        ),
        "meta": ParagraphStyle("Meta", parent=base["Normal"], fontSize=9, textColor=colors.grey),
        "section": ParagraphStyle(
            "Section", parent=base["Heading2"], fontSize=13, spaceBefore=10, spaceAfter=4
        ),
    }


def build_receipt_pdf(
    transaction_code: str,
    sale_date: str,
    customer_name: str,
    cashier: str | None,
    lines: list[dict],
    total_revenue: Decimal,
    total_cost: Decimal,
    total_profit: Decimal,
) -> bytes:
    styles = _styles()
    story = [
        Paragraph(SHOP_NAME, styles["shop"]),
        Paragraph(SHOP_ADDRESS, styles["meta"]),
        Paragraph(f"Tel: {SHOP_PHONE}", styles["meta"]),
        Spacer(1, 6 * mm),
        Paragraph("Sales Receipt", styles["section"]),
        Paragraph(f"Transaction Code: {transaction_code}", styles["meta"]),
        Paragraph(f"Date: {sale_date}", styles["meta"]),
        Paragraph(f"Customer: {customer_name or 'Walk-in Customer'}", styles["meta"]),
        Paragraph(f"Cashier: {cashier or '-'}", styles["meta"]),
        Spacer(1, 4 * mm),
    ]

    table_data = [["#", "SKU", "Product", "Qty", "Unit Price", "Line Total"]]
    for index, line in enumerate(lines, start=1):
        table_data.append(
            [
                str(index),
                line["sku_code"],
                line["name"],
                str(line["quantity"]),
                f"{line['unit_selling_price']:,.2f}",
                f"{line['line_revenue']:,.2f}",
            ]
        )

    table = Table(table_data, colWidths=[10 * mm, 32 * mm, 62 * mm, 14 * mm, 26 * mm, 28 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                *[("BACKGROUND", (0, i), (-1, i), ZEBRA_BG) for i in range(2, len(table_data), 2)],
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 5 * mm))

    totals = Table(
        [
            ["Total Revenue (Rs.)", f"{total_revenue:,.2f}"],
            ["Cost of Goods Sold (Rs.)", f"{total_cost:,.2f}"],
            ["Net Profit (Rs.)", f"{total_profit:,.2f}"],
        ],
        colWidths=[110 * mm, 62 * mm],
        hAlign="RIGHT",
    )
    totals.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("LINEABOVE", (0, 0), (-1, 0), 0.6, colors.HexColor("#94a3b8")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(totals)
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph("Thank you for your business!", styles["meta"]))

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=15 * mm, bottomMargin=15 * mm)
    doc.build(story)
    return buffer.getvalue()


def build_tabular_pdf(title: str, subtitle: str, headers: list[str], rows: list[list[str]]) -> bytes:
    styles = _styles()
    story = [
        Paragraph(title, styles["shop"]),
        Paragraph(subtitle, styles["meta"]),
        Spacer(1, 6 * mm),
    ]

    data = [headers] + rows
    usable = landscape(A4)[0] - 40 * mm
    col_width = usable / max(len(headers), 1)
    table = Table(data, colWidths=[col_width] * len(headers), repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    for i in range(2, len(data)):
        style.append(("BACKGROUND", (0, i), (-1, i), ZEBRA_BG))
    table.setStyle(TableStyle(style))
    story.append(table)

    def footer(canvas, doc) -> None:
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.drawRightString(
            landscape(A4)[0] - 20 * mm, 12 * mm, f"Page {canvas.getPageNumber()}"
        )
        canvas.restoreState()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), topMargin=15 * mm, bottomMargin=18 * mm)
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()
