from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    Numeric,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SaleItemModel(Base):
    __tablename__ = "sale_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_sale_items_quantity_positive"),
        CheckConstraint("unit_buying_price >= 0", name="ck_sale_items_buying_price"),
        CheckConstraint("unit_selling_price >= 0", name="ck_sale_items_selling_price"),
        CheckConstraint("line_revenue >= 0", name="ck_sale_items_line_revenue"),
        Index("idx_sale_items_product", "product_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(
        ForeignKey("sales.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_buying_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    unit_selling_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    line_revenue: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    line_profit: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    sale = relationship("SaleModel", back_populates="items")
    product = relationship("ProductModel")
