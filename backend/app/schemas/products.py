from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.categories import CategoryBrief
from app.schemas.suppliers import SupplierBrief


def _validate_image_url(value: str | None) -> str | None:
    if value is not None and not (value.startswith("http://") or value.startswith("https://")):
        raise ValueError("image_url must be a valid http(s) URL.")
    return value


class ProductCreate(BaseModel):
    sku_code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    category_id: int
    supplier_id: int | None = None
    description: str | None = None
    image_url: str | None = None
    buying_price: Decimal = Field(ge=0)
    selling_price: Decimal = Field(ge=0)
    current_stock: int = Field(default=0, ge=0)
    min_stock_alert: int = Field(default=5, ge=0)

    @model_validator(mode="after")
    def check_prices(self) -> "ProductCreate":
        if self.selling_price < self.buying_price:
            raise ValueError("selling_price must be greater than or equal to buying_price.")
        return self

    @field_validator("image_url")
    @classmethod
    def image_url_ok(cls, value: str | None) -> str | None:
        return _validate_image_url(value)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    category_id: int | None = None
    supplier_id: int | None = None
    description: str | None = None
    image_url: str | None = None
    buying_price: Decimal | None = Field(default=None, ge=0)
    selling_price: Decimal | None = Field(default=None, ge=0)
    current_stock: int | None = Field(default=None, ge=0)
    min_stock_alert: int | None = Field(default=None, ge=0)
    is_archived: bool | None = None

    @model_validator(mode="after")
    def check_prices(self) -> "ProductUpdate":
        if (
            self.buying_price is not None
            and self.selling_price is not None
            and self.selling_price < self.buying_price
        ):
            raise ValueError("selling_price must be greater than or equal to buying_price.")
        return self

    @field_validator("image_url")
    @classmethod
    def image_url_ok(cls, value: str | None) -> str | None:
        return _validate_image_url(value)


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sku_code: str
    name: str
    category_id: int
    supplier_id: int | None
    description: str | None
    image_url: str | None
    buying_price: Decimal
    selling_price: Decimal
    current_stock: int
    min_stock_alert: int
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    category: CategoryBrief | None = None
    supplier: SupplierBrief | None = None
