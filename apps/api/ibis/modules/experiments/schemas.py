"""Schemas expériences (CDC §8, §7.3)."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from ibis.modules.ml.preprocessing import PreprocessingConfig


class ExperimentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: uuid.UUID
    dataset_id: uuid.UUID
    algorithm: str
    hyperparameters: dict[str, Any] = Field(default_factory=dict)
    preprocessing: PreprocessingConfig


class DraftUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: uuid.UUID
    dataset_id: uuid.UUID
    state: dict[str, Any]  # état du store wizard (source unique côté client, P3)


class ExperimentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    dataset_id: uuid.UUID
    algorithm: str | None
    hyperparameters: dict[str, Any]
    preprocessing_config: dict[str, Any]
    status: str
    progress: int
    job_id: uuid.UUID | None
    error_code: str | None
    error_message: str | None
    draft_state: dict[str, Any] | None
    started_at: datetime | None
    finished_at: datetime | None
    duration_seconds: float | None
    created_at: datetime
    updated_at: datetime


class ExperimentWithQueue(ExperimentRead):
    queue_position: int | None = None


class ExperimentSummary(BaseModel):
    """Ligne de l'onglet Expériences du projet (benchmarking, CDC §7.2)."""

    id: uuid.UUID
    dataset_id: uuid.UUID
    dataset_name: str
    algorithm: str | None
    status: str
    progress: int
    primary_metric_name: str | None
    primary_metric_value: float | None
    duration_seconds: float | None
    created_at: datetime


class ExperimentResults(BaseModel):
    id: uuid.UUID
    status: str
    task_type: str
    algorithm: str
    metrics: dict[str, Any]
    viz_data: dict[str, Any]
    feature_importance: list[dict[str, Any]]
    applied_preprocessing: dict[str, Any]
    composite: dict[str, Any]
    class_names: list[str] | None


class CompareRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    experiment_ids: list[uuid.UUID] = Field(min_length=2, max_length=8)


class CompareRow(BaseModel):
    experiment_id: uuid.UUID
    dataset_name: str
    algorithm: str
    task_type: str
    metrics: dict[str, Any]


class CompareResponse(BaseModel):
    rows: list[CompareRow]
    metric_keys: list[str]  # métriques communes alignées


class LogLine(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ts: datetime
    level: str
    message: str
