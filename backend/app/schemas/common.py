from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Paginated(BaseModel, Generic[T]):
    items: list[T]
    page: int
    page_size: int
    total: int
    pages: int

    @classmethod
    def build(cls, items: list[T], page: int, page_size: int, total: int) -> "Paginated[T]":
        pages = (total + page_size - 1) // page_size if total else 0
        return cls(items=items, page=page, page_size=page_size, total=total, pages=pages)
