"""Service projets : CRUD isolé par user_id + recommandations via LE module scoring (P3)."""

import math
import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ibis.core.errors import NotFoundError
from ibis.modules.datasets.schemas import DatasetFilters
from ibis.modules.projects.models import Project
from ibis.modules.projects.schemas import ProjectInput, ProjectPage, ProjectRead
from ibis.modules.scoring.schemas import CriterionWeight, ScoreResponse
from ibis.modules.scoring.service import score_datasets


def normalize_weights_if_needed(weights: dict[str, float]) -> dict[str, float]:
    """Normalisation automatique si Σ > 1 (CDC §7.2) — sinon poids conservés tels quels."""
    total = sum(weights.values())
    if total > 1 and total > 0:
        return {name: round(weight / total, 4) for name, weight in weights.items()}
    return weights


def active_criteria_count(criteria: dict) -> int:
    return sum(1 for value in criteria.values() if value not in (None, [], "", False))


def to_read(project: Project) -> ProjectRead:
    return ProjectRead(
        id=project.id,
        name=project.name,
        description=project.description,
        criteria=project.criteria,
        weights=project.weights,
        active_criteria_count=active_criteria_count(project.criteria),
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


def get_project(db: Session, user_id: uuid.UUID, project_id: uuid.UUID) -> Project:
    """Isolation stricte : le projet d'un autre utilisateur est INTROUVABLE (404)."""
    project = db.scalar(select(Project).where(Project.id == project_id, Project.user_id == user_id))
    if project is None:
        raise NotFoundError("Projet introuvable", code="PROJECT_NOT_FOUND")
    return project


def list_projects(
    db: Session, user_id: uuid.UUID, *, q: str | None, page: int, page_size: int
) -> ProjectPage:
    query = select(Project).where(Project.user_id == user_id)
    count = select(func.count(Project.id)).where(Project.user_id == user_id)
    if q:
        like = f"%{q.strip()}%"
        condition = or_(Project.name.ilike(like), Project.description.ilike(like))
        query = query.where(condition)
        count = count.where(condition)
    total = db.scalar(count) or 0
    items = db.scalars(
        query.order_by(Project.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return ProjectPage(
        items=[to_read(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


def create_project(db: Session, user_id: uuid.UUID, payload: ProjectInput) -> Project:
    project = Project(
        user_id=user_id,
        name=payload.name,
        description=payload.description,
        criteria=payload.criteria.model_dump(exclude_none=True),
        weights=normalize_weights_if_needed(payload.weights),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def update_project(db: Session, project: Project, payload: ProjectInput) -> Project:
    project.name = payload.name
    project.description = payload.description
    project.criteria = payload.criteria.model_dump(exclude_none=True)
    project.weights = normalize_weights_if_needed(payload.weights)
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project: Project) -> None:
    db.delete(project)
    db.commit()


def recommendations(db: Session, project: Project) -> ScoreResponse:
    """Le classement du projet = LE scoring backend appliqué à ses critères/poids (P3)."""
    filters = DatasetFilters.model_validate(project.criteria)
    weights = [
        CriterionWeight(criterion_name=name, weight=weight)
        for name, weight in project.weights.items()
    ]
    return score_datasets(db, filters=filters, weights=weights)
