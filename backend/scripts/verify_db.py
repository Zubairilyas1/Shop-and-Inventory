import asyncio

from sqlalchemy import text

from app.db.session import AsyncSessionLocal


async def check() -> None:
    async with AsyncSessionLocal() as db:
        tables = await db.scalar(
            text(
                "SELECT STRING_AGG(tablename, ', ' ORDER BY tablename) "
                "FROM pg_tables WHERE schemaname = 'public'"
            )
        )
        seq = await db.scalar(text("SELECT LAST_VALUE FROM transaction_code_seq"))
        users = await db.execute(text("SELECT username, role, is_active FROM users"))
        print("TABLES:", tables)
        print("SEQ last_value:", seq)
        for row in users:
            print("USER:", tuple(row))


if __name__ == "__main__":
    asyncio.run(check())
