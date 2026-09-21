"""Domain exceptions -> consistent error envelope per docs/04-api-specification.md."""
from typing import Any


class AppError(Exception):
    code: str = "APP_ERROR"
    status_code: int = 500
    message: str = "Internal error"

    def __init__(self, message: str | None = None, details: Any = None):
        super().__init__(message or self.message)
        if message:
            self.message = message
        self.details = details


class UnauthorizedError(AppError):
    code = "UNAUTHORIZED"
    status_code = 401
    message = "Not authenticated"


class ForbiddenError(AppError):
    code = "FORBIDDEN"
    status_code = 403
    message = "Not authorized"


class NotFoundError(AppError):
    code = "NOT_FOUND"
    status_code = 404
    message = "Not found"


class ValidationAppError(AppError):
    code = "VALIDATION_ERROR"
    status_code = 422
    message = "Invalid request"


class ConflictError(AppError):
    code = "CONFLICT"
    status_code = 409
    message = "Conflict"
