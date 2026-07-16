"""Erreurs applicatives typées + handlers FastAPI.

Contrat d'erreur unique pour tout le backend :
    { "detail": { "code": "<ERROR_CODE>", "message": "<human readable>" } }
Le code (stable, machine-readable) alimente le front i18n ; le message aide au debug.
"""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    status_code = 400
    code = "APP_ERROR"

    def __init__(
        self, message: str = "", *, code: str | None = None, status_code: int | None = None
    ):
        self.message = message or self.__class__.__name__
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code
        super().__init__(self.message)


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"


class ForbiddenError(AppError):
    status_code = 403
    code = "FORBIDDEN"


class UnauthorizedError(AppError):
    status_code = 401
    code = "UNAUTHORIZED"


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"


class QuotaExceededError(AppError):
    status_code = 429
    code = "QUOTA_EXCEEDED"


class InvalidInputError(AppError):
    status_code = 422
    code = "INVALID_INPUT"


class ServiceUnavailableError(AppError):
    status_code = 503
    code = "SERVICE_UNAVAILABLE"


def error_payload(code: str, message: str) -> dict[str, Any]:
    return {"detail": {"code": code, "message": message}}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload(exc.code, exc.message),
            headers=headers,
        )
