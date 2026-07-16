"""Création de l'application FastAPI — routers, middlewares, handlers d'erreurs."""

import uuid
from collections.abc import Awaitable, Callable

import structlog
from fastapi import FastAPI, Request, Response

from ibis import __version__
from ibis.core.errors import register_error_handlers
from ibis.core.logging import configure_logging, get_logger
from ibis.modules.health.routes import router as health_router
from ibis.modules.jobs.routes import router as jobs_router

API_PREFIX = "/api/v1"

logger = get_logger(__name__)


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(
        title="IBIS-X API",
        version=__version__,
        description=(
            "API d'IBIS-X v2 — plateforme d'accompagnement ML de bout en bout "
            "(sélection éthique de datasets, pipeline guidé, explicabilité)."
        ),
        openapi_url=f"{API_PREFIX}/openapi.json",
        docs_url=f"{API_PREFIX}/docs",
        redoc_url=None,
    )

    @app.middleware("http")
    async def request_context(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = request.headers.get("x-request-id", uuid.uuid4().hex[:12])
        structlog.contextvars.bind_contextvars(request_id=request_id)
        try:
            response = await call_next(request)
        finally:
            structlog.contextvars.unbind_contextvars("request_id")
        response.headers["x-request-id"] = request_id
        return response

    register_error_handlers(app)

    app.include_router(health_router, prefix=API_PREFIX)
    app.include_router(jobs_router, prefix=API_PREFIX)

    return app


app = create_app()
