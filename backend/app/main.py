"""prezento FastAPI application factory."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import settings
from app.database.connection import init_db


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("prezento")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the database on startup."""
    logger.info("prezento backend starting…")
    logger.info("Database: %s", settings.db_path)
    logger.info("Ollama: %s (model: %s)", settings.ollama_host, settings.ollama_model)
    init_db()
    yield
    logger.info("prezento backend shutting down.")


def create_app() -> FastAPI:
    """Build the FastAPI application."""
    app = FastAPI(
        title="prezento API",
        description="AI-powered presentation generator. 100% free, runs on local Ollama models.",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_list or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router, prefix="/api", tags=["prezento"])

    @app.get("/")
    async def root() -> dict:
        return {
            "name": "prezento API",
            "version": "1.0.0",
            "docs": "/docs",
            "health": "/api/health",
        }

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
