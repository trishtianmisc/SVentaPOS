"""VentaPOS FastAPI entrypoint - modular monolith. See docs/02-system-architecture.md."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.middleware.error_handler import register_error_handlers
from app.middleware.logging_mw import logging_middleware

setup_logging(settings.log_level)

app = FastAPI(
    title="VentaPOS API",
    version="0.1.0",
    docs_url="/docs" if settings.is_dev else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.middleware("http")(logging_middleware)
register_error_handlers(app)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok", "env": settings.env}


@app.get(f"{settings.api_v1_prefix}/health", tags=["system"])
def health_v1():
    return {"status": "ok", "env": settings.env}
