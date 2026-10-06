from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.routers import (
    analytics,
    auth,
    categories,
    products,
    purchases,
    reports,
    sales,
    suppliers,
    users,
)
from app.core.config import settings
from app.core.errors import register_error_handlers
from app.db.session import AsyncSessionLocal


def create_app() -> FastAPI:
    application = FastAPI(
        title="Centralized Shop & Inventory Management API",
        version="3.0.0",
        description="Production REST API per PRD v3.0",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(application)

    prefix = "/api/v1"
    application.include_router(auth.router, prefix=prefix)
    application.include_router(users.router, prefix=prefix)
    application.include_router(products.router, prefix=prefix)
    application.include_router(categories.router, prefix=prefix)
    application.include_router(suppliers.router, prefix=prefix)
    application.include_router(purchases.router, prefix=prefix)
    application.include_router(sales.router, prefix=prefix)
    application.include_router(analytics.router, prefix=prefix)
    application.include_router(reports.router, prefix=prefix)
    return application


app = create_app()


@app.get("/health")
async def health() -> dict:
    async with AsyncSessionLocal() as session:
        await session.execute(text("SELECT 1"))
    return {"status": "ok"}
