import asyncio

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.user import UserModel, UserRole


async def seed() -> None:
    if not settings.admin_initial_password:
        print("Set ADMIN_INITIAL_PASSWORD in backend/.env before running this script.")
        return

    async with AsyncSessionLocal() as db:
        existing = await db.scalar(
            select(UserModel).where(UserModel.username == settings.admin_username)
        )
        if existing is not None:
            print(f"User '{settings.admin_username}' already exists. Nothing to do.")
            return

        admin = UserModel(
            username=settings.admin_username,
            password_hash=hash_password(settings.admin_initial_password),
            full_name="System Administrator",
            role=UserRole.admin,
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        print(f"Admin user '{settings.admin_username}' created successfully.")


if __name__ == "__main__":
    asyncio.run(seed())
