"""Routes /projects (CDC §7.3) — isolation stricte par user_id sur CHAQUE route."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ibis.db.engine import get_db
from ibis.modules.auth.deps import CurrentClaims
from ibis.modules.projects import service
from ibis.modules.projects.schemas import ProjectInput, ProjectPage, ProjectRead
from ibis.modules.scoring.schemas import ScoreResponse

router = APIRouter(prefix="/projects", tags=["projects"])

DbDep = Annotated[Session, Depends(get_db)]


@router.get("", response_model=ProjectPage, operation_id="listProjects")
def list_projects(
    db: DbDep,
    claims: CurrentClaims,
    q: Annotated[str | None, Query(max_length=200)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=48)] = 12,
) -> ProjectPage:
    return service.list_projects(db, claims.user_id, q=q, page=page, page_size=page_size)


@router.post("", response_model=ProjectRead, status_code=201, operation_id="createProject")
def create_project(payload: ProjectInput, db: DbDep, claims: CurrentClaims) -> ProjectRead:
    return service.to_read(service.create_project(db, claims.user_id, payload))


@router.get("/{project_id}", response_model=ProjectRead, operation_id="getProject")
def get_project(project_id: uuid.UUID, db: DbDep, claims: CurrentClaims) -> ProjectRead:
    return service.to_read(service.get_project(db, claims.user_id, project_id))


@router.put("/{project_id}", response_model=ProjectRead, operation_id="updateProject")
def update_project(
    project_id: uuid.UUID, payload: ProjectInput, db: DbDep, claims: CurrentClaims
) -> ProjectRead:
    project = service.get_project(db, claims.user_id, project_id)
    return service.to_read(service.update_project(db, project, payload))


@router.delete("/{project_id}", status_code=204, operation_id="deleteProject")
def delete_project(project_id: uuid.UUID, db: DbDep, claims: CurrentClaims) -> None:
    service.delete_project(db, service.get_project(db, claims.user_id, project_id))


@router.get(
    "/{project_id}/recommendations",
    response_model=ScoreResponse,
    operation_id="getProjectRecommendations",
)
def get_recommendations(project_id: uuid.UUID, db: DbDep, claims: CurrentClaims) -> ScoreResponse:
    """Classement complet des datasets selon les critères/poids du projet (CDC §7.2)."""
    return service.recommendations(db, service.get_project(db, claims.user_id, project_id))
