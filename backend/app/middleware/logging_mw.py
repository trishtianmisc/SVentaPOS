"""Request logging with request-id. Keep lightweight for POS latency."""
import time
import uuid

import structlog
from fastapi import Request

log = structlog.get_logger("ventapos.requests")


async def logging_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid.uuid4())[:8])
    structlog.contextvars.bind_contextvars(request_id=request_id)
    start = time.perf_counter()
    try:
        response = await call_next(request)
    finally:
        elapsed_ms = (time.perf_counter() - start) * 1000
        log.info(
            "request",
            method=request.method,
            path=request.url.path,
            elapsed_ms=round(elapsed_ms, 1),
        )
        structlog.contextvars.unbind_contextvars("request_id")
        try:
            response.headers["X-Request-ID"] = request_id
        except Exception:
            pass
    return response
