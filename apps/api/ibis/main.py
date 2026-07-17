"""Création de l'application FastAPI — routers, middlewares, handlers d'erreurs."""

import uuid
from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, Response

from ibis import __version__
from ibis.core.errors import register_error_handlers
from ibis.core.logging import configure_logging, get_logger
from ibis.modules.auth.routes import router as auth_router
from ibis.modules.datasets.routes import router as datasets_router
from ibis.modules.experiments.routes import router as experiments_router
from ibis.modules.health.routes import router as health_router
from ibis.modules.jobs.routes import router as jobs_router
from ibis.modules.projects.routes import router as projects_router
from ibis.modules.scoring.routes import router as scoring_router
from ibis.modules.users.routes import router as users_router
from ibis.modules.xai.routes import router as xai_router

API_PREFIX = "/api/v1"

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    from ibis.modules.auth.bootstrap import ensure_initial_admin

    ensure_initial_admin()
    yield


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(
        lifespan=lifespan,
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
    app.include_router(auth_router, prefix=API_PREFIX)
    app.include_router(users_router, prefix=API_PREFIX)
    app.include_router(scoring_router, prefix=API_PREFIX)  # avant datasets (/datasets/score)
    app.include_router(projects_router, prefix=API_PREFIX)
    app.include_router(experiments_router, prefix=API_PREFIX)
    app.include_router(xai_router, prefix=API_PREFIX)
    app.include_router(datasets_router, prefix=API_PREFIX)

    return app


app = create_app()
