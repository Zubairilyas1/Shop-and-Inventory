from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ProductModel(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("buying_price >= 0", name="ck_products_buying_price"),
        CheckConstraint("selling_price >= buying_price", name="ck_products_selling_gte_buying"),
        CheckConstraint("current_stock >= 0", name="ck_products_stock_nonnegative"),
        CheckConstraint("min_stock_alert >= 0", name="ck_products_min_alert_nonnegative"),
        Index(
            "idx_products_name_trgm",
            "name",
            postgresql_using="gin",
            postgresql_ops={"name": "gin_trgm_ops"},
        ),
        Index("idx_products_category", "category_id"),
        Index(
            "idx_products_low_stock",
            "current_stock",
            "min_stock_alert",
            postgresql_where=text("is_archived = FALSE"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sku_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False
    )
    supplier_id: Mapped[int | None] = mapped_column(
        ForeignKey("suppliers.id", ondelete="SET NULL")
    )
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(Text)
    buying_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    selling_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    current_stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    min_stock_alert: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    category = relationship("CategoryModel", lazy="selectin")
    supplier = relationship("SupplierModel", lazy="selectin")
