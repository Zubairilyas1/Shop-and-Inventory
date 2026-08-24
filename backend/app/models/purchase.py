from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PurchaseModel(Base):
    __tablename__ = "purchases"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_purchases_quantity_positive"),
        CheckConstraint("unit_buying_price >= 0", name="ck_purchases_unit_price"),
        CheckConstraint("total_cost >= 0", name="ck_purchases_total_cost"),
        Index("idx_purchases_date", "purchase_date"),
        Index("idx_purchases_product", "product_id"),
        Index("idx_purchases_supplier", "supplier_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    supplier_id: Mapped[int] = mapped_column(
        ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_buying_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    invoice_number: Mapped[str] = mapped_column(String(100), nullable=False)
    purchase_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    product = relationship("ProductModel", lazy="joined")
    supplier = relationship("SupplierModel", lazy="joined")
