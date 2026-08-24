from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CheckoutItem(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class CheckoutRequest(BaseModel):
    customer_name: str | None = Field(default=None, max_length=150)
    items: list[CheckoutItem] = Field(min_length=1)

    @model_validator(mode="after")
    def no_duplicate_products(self) -> "CheckoutRequest":
        ids = [item.product_id for item in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate product_id entries in cart.")
        return self


class SaleItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    quantity: int
    unit_buying_price: Decimal
    unit_selling_price: Decimal
    line_revenue: Decimal
    line_profit: Decimal
    product_name: str | None = None
    product_sku: str | None = None


class SaleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    transaction_code: str
    customer_name: str | None
    total_revenue: Decimal
    total_cost: Decimal
    total_profit: Decimal
    sale_date: datetime


class SaleDetailOut(SaleOut):
    items: list[SaleItemOut] = []


class CheckoutResponse(SaleDetailOut):
    pass
