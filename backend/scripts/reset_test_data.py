import asyncio

from sqlalchemy import text

from app.db.session import AsyncSessionLocal


async def reset() -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(text("DELETE FROM sale_items"))
        await db.execute(text("DELETE FROM sales"))
        await db.execute(text("DELETE FROM purchases"))
        await db.execute(text("DELETE FROM products"))
        await db.execute(text("DELETE FROM categories"))
        await db.execute(text("DELETE FROM suppliers"))
        await db.execute(text("ALTER SEQUENCE transaction_code_seq RESTART WITH 1"))
        await db.commit()
        counts = await db.execute(
            text(
                "SELECT (SELECT COUNT(*) FROM products), (SELECT COUNT(*) FROM sales), "
                "(SELECT COUNT(*) FROM categories)"
            )
        )
        print("Remaining products/sales/categories:", tuple(counts.one()))


if __name__ == "__main__":
    asyncio.run(reset())
