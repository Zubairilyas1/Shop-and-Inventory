"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-08-24
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    user_role = postgresql.ENUM("admin", "manager", name="user_role")
    user_role.create(op.get_bind(), checkfirst=True)
    user_role_column_type = postgresql.ENUM(
        "admin", "manager", name="user_role", create_type=False
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(50), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(200), nullable=False),
        sa.Column("full_name", sa.String(150), nullable=True),
        sa.Column("role", user_role_column_type, nullable=False, server_default="manager"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("idx_users_username", "users", ["username"])

    op.create_table(
        "token_blocklist",
        sa.Column("jti", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "revoked_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("idx_blocklist_expires", "token_blocklist", ["expires_at"])

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint("char_length(name) > 0", name="ck_categories_name_len"),
    )

    op.create_table(
        "suppliers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("contact_info", sa.Text(), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )

    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sku_code", sa.String(50), nullable=False, unique=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column(
            "category_id",
            sa.Integer(),
            sa.ForeignKey("categories.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "supplier_id",
            sa.Integer(),
            sa.ForeignKey("suppliers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("buying_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("selling_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("current_stock", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("min_stock_alert", sa.Integer(), nullable=False, server_default=sa.text("5")),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint("buying_price >= 0", name="ck_products_buying_price"),
        sa.CheckConstraint("selling_price >= buying_price", name="ck_products_selling_gte_buying"),
        sa.CheckConstraint("current_stock >= 0", name="ck_products_stock_nonnegative"),
        sa.CheckConstraint("min_stock_alert >= 0", name="ck_products_min_alert_nonnegative"),
    )
    op.create_index(
        "idx_products_name_trgm",
        "products",
        ["name"],
        postgresql_using="gin",
        postgresql_ops={"name": "gin_trgm_ops"},
    )
    op.create_index("idx_products_category", "products", ["category_id"])
    op.create_index(
        "idx_products_low_stock",
        "products",
        ["current_stock", "min_stock_alert"],
        postgresql_where=sa.text("is_archived = FALSE"),
    )

    op.create_table(
        "purchases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "product_id",
            sa.Integer(),
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "supplier_id",
            sa.Integer(),
            sa.ForeignKey("suppliers.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_buying_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("total_cost", sa.Numeric(12, 2), nullable=False),
        sa.Column("invoice_number", sa.String(100), nullable=False),
        sa.Column(
            "purchase_date",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint("quantity > 0", name="ck_purchases_quantity_positive"),
        sa.CheckConstraint("unit_buying_price >= 0", name="ck_purchases_unit_price"),
        sa.CheckConstraint("total_cost >= 0", name="ck_purchases_total_cost"),
    )
    op.create_index("idx_purchases_date", "purchases", ["purchase_date"])
    op.create_index("idx_purchases_product", "purchases", ["product_id"])
    op.create_index("idx_purchases_supplier", "purchases", ["supplier_id"])

    op.create_table(
        "sales",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("transaction_code", sa.String(100), nullable=False, unique=True),
        sa.Column("customer_name", sa.String(150), nullable=True),
        sa.Column("total_revenue", sa.Numeric(12, 2), nullable=False),
        sa.Column("total_cost", sa.Numeric(12, 2), nullable=False),
        sa.Column("total_profit", sa.Numeric(12, 2), nullable=False),
        sa.Column(
            "sold_by",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "sale_date",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint("total_revenue >= 0", name="ck_sales_total_revenue"),
        sa.CheckConstraint("total_cost >= 0", name="ck_sales_total_cost"),
    )
    op.create_index("idx_sales_date", "sales", ["sale_date"])
    op.create_index(
        "idx_sales_customer_trgm",
        "sales",
        ["customer_name"],
        postgresql_using="gin",
        postgresql_ops={"customer_name": "gin_trgm_ops"},
    )

    op.create_table(
        "sale_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "sale_id",
            sa.Integer(),
            sa.ForeignKey("sales.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "product_id",
            sa.Integer(),
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_buying_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("unit_selling_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("line_revenue", sa.Numeric(12, 2), nullable=False),
        sa.Column("line_profit", sa.Numeric(12, 2), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_sale_items_quantity_positive"),
        sa.CheckConstraint("unit_buying_price >= 0", name="ck_sale_items_buying_price"),
        sa.CheckConstraint("unit_selling_price >= 0", name="ck_sale_items_selling_price"),
        sa.CheckConstraint("line_revenue >= 0", name="ck_sale_items_line_revenue"),
    )
    op.create_index("idx_sale_items_sale", "sale_items", ["sale_id"])
    op.create_index("idx_sale_items_product", "sale_items", ["product_id"])

    op.execute("CREATE SEQUENCE transaction_code_seq START 1")


def downgrade() -> None:
    op.drop_table("sale_items")
    op.drop_table("sales")
    op.drop_table("purchases")
    op.drop_table("products")
    op.drop_table("suppliers")
    op.drop_table("categories")
    op.drop_table("token_blocklist")
    op.drop_table("users")
    op.execute("DROP SEQUENCE IF EXISTS transaction_code_seq")
    postgresql.ENUM(name="user_role").drop(op.get_bind(), checkfirst=True)
