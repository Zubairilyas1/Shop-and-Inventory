from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SupplierBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class SupplierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    contact_info: str | None = None
    address: str | None = None


class SupplierUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    contact_info: str | None = None
    address: str | None = None


class SupplierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    contact_info: str | None
    address: str | None
    created_at: datetime
