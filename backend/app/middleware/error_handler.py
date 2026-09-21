"""Consistent error envelope: {"error": {"code": ..., "message": ...}}."""
import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.exceptions import AppError

log = structlog.get_logger("ventapos.errors")


def _envelope(code: str, message: str):
    return {"error": {"code": code, "message": message}}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError):
        log.warning("app_error", code=exc.code, message=exc.message)
        return JSONResponse(status_code=exc.status_code, content=_envelope(exc.code, exc.message))

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_: Request, exc: RequestValidationError):
        log.warning("validation_error", errors=str(exc.errors()[:3]))
        return JSONResponse(
            status_code=422, content=_envelope("VALIDATION_ERROR", "Invalid request")
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_handler(_: Request, exc: StarletteHTTPException):
        code = "NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR"
        return JSONResponse(status_code=exc.status_code, content=_envelope(code, str(exc.detail)))

    @app.exception_handler(Exception)
    async def unhandled_handler(_: Request, exc: Exception):
        log.error("unhandled_error", error=str(exc))
        return JSONResponse(status_code=500, content=_envelope("INTERNAL_ERROR", "Internal error"))
