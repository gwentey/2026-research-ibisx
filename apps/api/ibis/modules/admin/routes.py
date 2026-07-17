"""Routes /admin (CDC §11) — CHAQUE route revérifie le rôle admin EN BASE (ARCH §7.2).

[NE PAS REPRODUIRE] S1/S2 (endpoints sans contrôle) ni `/admin/temporary-grant`.
Toute action est tracée dans audit_events.
"""

import math
import uuid
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ibis.core.errors import ConflictError, InvalidInputError, NotFoundError
from ibis.db.engine import get_db
from ibis.modules.admin.models import AuditEvent
from ibis.modules.auth.deps import CurrentAdminVerified
from ibis.modules.auth.models import User, UserRole
from ibis.modules.auth.schemas import UserRead
from ibis.modules.datasets.ethics import ETHICAL_CRITERIA
from ibis.modules.datasets.models import Dataset, EthicalTemplate
from ibis.modules.jobs.models import Job

router = APIRouter(prefix="/admin", tags=["admin"])

DbDep = Annotated[Session, Depends(get_db)]


def audit(db: Session, admin: User, action: str, entity: str, entity_id: str, **meta: Any) -> None:
    """Trace l'action dans audit_events — commitée avec la transaction de la route."""
    db.add(
        AuditEvent(user_id=admin.id, action=action, entity=entity, entity_id=entity_id, meta=meta)
    )


# ------------------------------------ Utilisateurs -------------------------------------------


class AdminUserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: UserRole | None = None
    is_active: bool | None = None
    add_credits: int | None = Field(default=None, ge=1, le=1000)


class UserPage(BaseModel):
    items: list[UserRead]
    total: int
    page: int
    total_pages: int


def _other_active_admins(db: Session, user_id: uuid.UUID) -> int:
    return int(
        db.scalar(
            select(func.count(User.id)).where(
                User.role == UserRole.admin, User.is_active.is_(True), User.id != user_id
            )
        )
        or 0
    )


@router.get("/users", response_model=UserPage, operation_id="adminListUsers")
def list_users(
    db: DbDep,
    _admin: CurrentAdminVerified,
    q: Annotated[str | None, Query(max_length=200)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=5, le=100)] = 20,
) -> UserPage:
    query = select(User)
    count = select(func.count(User.id))
    if q:
        like = f"%{q.strip()}%"
        condition = or_(User.email.ilike(like), User.pseudo.ilike(like))
        query = query.where(condition)
        count = count.where(condition)
    total = db.scalar(count) or 0
    users = db.scalars(
        query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return UserPage(
        items=[UserRead.model_validate(u) for u in users],
        total=total,
        page=page,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.patch("/users/{user_id}", response_model=UserRead, operation_id="adminUpdateUser")
def update_user(
    user_id: uuid.UUID, payload: AdminUserUpdate, db: DbDep, admin: CurrentAdminVerified
) -> UserRead:
    """Rôle, activation, recharge de crédits — garde du DERNIER admin actif (CDC §11)."""
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("Utilisateur introuvable", code="USER_NOT_FOUND")

    demoting = payload.role is not None and payload.role != UserRole.admin
    deactivating = payload.is_active is False
    if (
        user.role == UserRole.admin
        and (demoting or deactivating)
        and _other_active_admins(db, user.id) == 0
    ):
        raise ConflictError(
            "Impossible : ce compte est le dernier administrateur actif", code="LAST_ADMIN"
        )

    if payload.role is not None and payload.role != user.role:
        audit(
            db,
            admin,
            "role_changed",
            "user",
            str(user.id),
            from_=user.role.value,
            to=payload.role.value,
        )
        user.role = payload.role
    if payload.is_active is not None and payload.is_active != user.is_active:
        audit(db, admin, "active_changed", "user", str(user.id), to=payload.is_active)
        user.is_active = payload.is_active
    if payload.add_credits:
        user.credits += payload.add_credits
        audit(db, admin, "credits_granted", "user", str(user.id), amount=payload.add_credits)
    db.commit()
    db.refresh(user)
    return UserRead.model_validate(user)


@router.delete("/users/{user_id}", status_code=204, operation_id="adminDeleteUser")
def delete_user(user_id: uuid.UUID, db: DbDep, admin: CurrentAdminVerified) -> None:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("Utilisateur introuvable", code="USER_NOT_FOUND")
    if user.role == UserRole.admin and _other_active_admins(db, user.id) == 0:
        raise ConflictError("Impossible : dernier administrateur actif", code="LAST_ADMIN")
    audit(db, admin, "user_deleted", "user", str(user.id), email=user.email)
    db.delete(user)
    db.commit()


# ------------------------------------ Templates éthiques -------------------------------------


class TemplateUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    defaults: dict[str, bool | None]

    @field_validator("defaults")
    @classmethod
    def only_known_criteria(cls, value: dict[str, bool | None]) -> dict[str, bool | None]:
        unknown = set(value) - set(ETHICAL_CRITERIA)
        if unknown:
            raise ValueError(f"Critères inconnus : {sorted(unknown)}")
        return value


class TemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    domain: str
    defaults: dict[str, Any]
    updated_at: datetime


@router.get(
    "/ethical-templates", response_model=list[TemplateRead], operation_id="adminListTemplates"
)
def list_templates(db: DbDep, _admin: CurrentAdminVerified) -> list[TemplateRead]:
    templates = db.scalars(select(EthicalTemplate).order_by(EthicalTemplate.domain)).all()
    return [TemplateRead.model_validate(t) for t in templates]


@router.put(
    "/ethical-templates/{domain}", response_model=TemplateRead, operation_id="adminUpsertTemplate"
)
def upsert_template(
    domain: str, payload: TemplateUpsert, db: DbDep, admin: CurrentAdminVerified
) -> TemplateRead:
    """Défauts éthiques par domaine, EN BASE — appliqués à l'import (CDC §11)."""
    domain = domain.strip().lower()[:50]
    if not domain:
        raise InvalidInputError("Domaine requis", code="DOMAIN_REQUIRED")
    template = db.scalar(select(EthicalTemplate).where(EthicalTemplate.domain == domain))
    if template is None:
        template = EthicalTemplate(domain=domain)
        db.add(template)
    template.defaults = payload.defaults
    template.updated_by = admin.id
    audit(db, admin, "template_upserted", "ethical_template", domain)
    db.commit()
    db.refresh(template)
    return TemplateRead.model_validate(template)


@router.delete("/ethical-templates/{domain}", status_code=204, operation_id="adminDeleteTemplate")
def delete_template(domain: str, db: DbDep, admin: CurrentAdminVerified) -> None:
    template = db.scalar(select(EthicalTemplate).where(EthicalTemplate.domain == domain))
    if template is None:
        raise NotFoundError("Template introuvable", code="TEMPLATE_NOT_FOUND")
    audit(db, admin, "template_deleted", "ethical_template", domain)
    db.delete(template)
    db.commit()


# ------------------------------------ Datasets & jobs ----------------------------------------


@router.post(
    "/datasets/{dataset_id}/reanalyze", status_code=202, operation_id="adminReanalyzeDataset"
)
def reanalyze_dataset(
    dataset_id: uuid.UUID, db: DbDep, admin: CurrentAdminVerified
) -> dict[str, Any]:
    """Relance l'analyse qualité (cache invalidé) — CDC §11."""
    from ibis.modules.ml.quality import get_or_compute_quality

    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise NotFoundError("Dataset introuvable", code="DATASET_NOT_FOUND")
    analysis = get_or_compute_quality(db, dataset_id, force=True)
    audit(db, admin, "dataset_reanalyzed", "dataset", str(dataset_id))
    db.commit()
    return {"dataset_id": str(dataset_id), "quality_score": analysis.quality_score}


class JobRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: str
    status: str
    queue: str
    progress: int
    user_id: uuid.UUID | None
    ref_id: uuid.UUID | None
    error_code: str | None
    created_at: datetime
    finished_at: datetime | None


@router.get("/jobs", response_model=list[JobRow], operation_id="adminListJobs")
def list_jobs(
    db: DbDep,
    _admin: CurrentAdminVerified,
    kind: Annotated[str | None, Query(max_length=20)] = None,
    status: Annotated[str | None, Query(max_length=20)] = None,
    limit: Annotated[int, Query(ge=10, le=200)] = 100,
) -> list[JobRow]:
    """Supervision : la table jobs alimentée par le worker (ARCH §6.2)."""
    query = select(Job).order_by(Job.created_at.desc()).limit(limit)
    if kind:
        query = query.where(Job.kind == kind)
    if status:
        query = query.where(Job.status == status)
    return [JobRow.model_validate(j) for j in db.scalars(query).all()]


class AuditRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    action: str
    entity: str
    entity_id: str
    meta: dict[str, Any]
    ts: datetime


@router.get("/audit", response_model=list[AuditRow], operation_id="adminListAudit")
def list_audit(
    db: DbDep,
    _admin: CurrentAdminVerified,
    limit: Annotated[int, Query(ge=10, le=200)] = 100,
) -> list[AuditRow]:
    events = db.scalars(select(AuditEvent).order_by(AuditEvent.ts.desc()).limit(limit)).all()
    return [AuditRow.model_validate(e) for e in events]
