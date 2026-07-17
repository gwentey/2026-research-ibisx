"""Dashboard M7 (CDC §10) — chaque chiffre est une agrégation SQL RÉELLE (P1).

[NE PAS REPRODUIRE] les tuiles mockées de la v1 : ici, zéro valeur décorative.
"""

import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ibis.db.engine import get_db
from ibis.modules.auth.deps import CurrentClaims
from ibis.modules.datasets.models import Dataset
from ibis.modules.experiments.models import Experiment, ExperimentStatus
from ibis.modules.projects.models import Project
from ibis.modules.xai.models import Explanation, ExplanationStatus

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

DbDep = Annotated[Session, Depends(get_db)]


class DashboardKpis(BaseModel):
    total_experiments: int
    active_projects: int
    success_rate: float | None  # None tant qu'aucune expérience terminée/échouée (P1)
    average_duration_seconds: float | None


class ActivityItem(BaseModel):
    kind: Literal["experiment", "explanation"]
    ref_id: uuid.UUID
    experiment_id: uuid.UUID
    label: str  # nom du dataset (expérience) ou méthode (explication)
    status: str
    created_at: datetime


class RecentProject(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    updated_at: datetime


class WizardDraftPointer(BaseModel):
    experiment_id: uuid.UUID
    project_id: uuid.UUID
    dataset_id: uuid.UUID
    dataset_name: str
    updated_at: datetime


class DashboardResponse(BaseModel):
    kpis: DashboardKpis
    recent_activity: list[ActivityItem]
    recent_projects: list[RecentProject]
    pending_draft: WizardDraftPointer | None


@router.get("", response_model=DashboardResponse, operation_id="getDashboard")
def get_dashboard(db: DbDep, claims: CurrentClaims) -> DashboardResponse:
    user_id = claims.user_id
    non_draft = Experiment.status != ExperimentStatus.draft

    total_experiments = (
        db.scalar(select(func.count(Experiment.id)).where(Experiment.user_id == user_id, non_draft))
        or 0
    )
    active_projects = (
        db.scalar(select(func.count(Project.id)).where(Project.user_id == user_id)) or 0
    )
    completed = (
        db.scalar(
            select(func.count(Experiment.id)).where(
                Experiment.user_id == user_id,
                Experiment.status == ExperimentStatus.completed,
            )
        )
        or 0
    )
    finished = (
        db.scalar(
            select(func.count(Experiment.id)).where(
                Experiment.user_id == user_id,
                Experiment.status.in_((ExperimentStatus.completed, ExperimentStatus.failed)),
            )
        )
        or 0
    )
    average_duration = db.scalar(
        select(func.avg(Experiment.duration_seconds)).where(
            Experiment.user_id == user_id, Experiment.status == ExperimentStatus.completed
        )
    )

    # Activités récentes : expériences + explications mêlées, 10 dernières
    experiment_rows = db.execute(
        select(Experiment, Dataset.display_name)
        .join(Dataset, Dataset.id == Experiment.dataset_id)
        .where(Experiment.user_id == user_id, non_draft)
        .order_by(Experiment.created_at.desc())
        .limit(10)
    ).all()
    explanation_rows = db.scalars(
        select(Explanation)
        .where(Explanation.user_id == user_id)
        .order_by(Explanation.created_at.desc())
        .limit(10)
    ).all()
    activity = [
        ActivityItem(
            kind="experiment",
            ref_id=experiment.id,
            experiment_id=experiment.id,
            label=dataset_name,
            status=experiment.status.value,
            created_at=experiment.created_at,
        )
        for experiment, dataset_name in experiment_rows
    ] + [
        ActivityItem(
            kind="explanation",
            ref_id=explanation.id,
            experiment_id=explanation.experiment_id,
            label=explanation.method_used or explanation.type.value,
            status=explanation.status.value,
            created_at=explanation.created_at,
        )
        for explanation in explanation_rows
    ]
    activity.sort(key=lambda item: item.created_at, reverse=True)

    recent_projects = db.scalars(
        select(Project)
        .where(Project.user_id == user_id)
        .order_by(Project.updated_at.desc())
        .limit(4)
    ).all()

    draft_row = db.execute(
        select(Experiment, Dataset.display_name)
        .join(Dataset, Dataset.id == Experiment.dataset_id)
        .where(Experiment.user_id == user_id, Experiment.status == ExperimentStatus.draft)
        .order_by(Experiment.updated_at.desc())
        .limit(1)
    ).first()
    pending_draft = (
        WizardDraftPointer(
            experiment_id=draft_row[0].id,
            project_id=draft_row[0].project_id,
            dataset_id=draft_row[0].dataset_id,
            dataset_name=draft_row[1],
            updated_at=draft_row[0].updated_at,
        )
        if draft_row
        else None
    )

    _ = ExplanationStatus  # (import utilisé pour la lisibilité du module)
    return DashboardResponse(
        kpis=DashboardKpis(
            total_experiments=total_experiments,
            active_projects=active_projects,
            success_rate=round(completed / finished, 4) if finished > 0 else None,
            average_duration_seconds=round(float(average_duration), 2)
            if average_duration is not None
            else None,
        ),
        recent_activity=activity[:10],
        recent_projects=[RecentProject.model_validate(p) for p in recent_projects],
        pending_draft=pending_draft,
    )
