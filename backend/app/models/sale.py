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
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SaleModel(Base):
    __tablename__ = "sales"
    __table_args__ = (
        CheckConstraint("total_revenue >= 0", name="ck_sales_total_revenue"),
        CheckConstraint("total_cost >= 0", name="ck_sales_total_cost"),
        Index("idx_sales_date", "sale_date"),
        Index(
            "idx_sales_customer_trgm",
            "customer_name",
            postgresql_using="gin",
            postgresql_ops={"customer_name": "gin_trgm_ops"},
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    customer_name: Mapped[str | None] = mapped_column(String(150))
    total_revenue: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_profit: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    sold_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    sale_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    items = relationship(
        "SaleItemModel",
        back_populates="sale",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
