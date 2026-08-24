from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.suppliers import SupplierBrief


class PurchaseProductBrief(BaseModel):
    id: int
    sku_code: str
    name: str

    model_config = ConfigDict(from_attributes=True)


class PurchaseCreate(BaseModel):
    product_id: int
    supplier_id: int
    quantity: int = Field(gt=0)
    unit_buying_price: Decimal = Field(ge=0)
    invoice_number: str = Field(min_length=1, max_length=100)


class PurchaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    supplier_id: int
    quantity: int
    unit_buying_price: Decimal
    total_cost: Decimal
    invoice_number: str
    purchase_date: datetime
    product: PurchaseProductBrief | None = None
    supplier: SupplierBrief | None = None
