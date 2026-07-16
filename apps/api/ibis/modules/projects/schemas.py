"""Schemas projets (CDC §7.3)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ibis.modules.datasets.schemas import DatasetFilters
from ibis.modules.scoring.formulas import CRITERIA


class ProjectInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    criteria: DatasetFilters = Field(default_factory=DatasetFilters)
    weights: dict[str, float] = Field(default_factory=dict)

    @field_validator("weights")
    @classmethod
    def known_criteria_and_bounds(cls, value: dict[str, float]) -> dict[str, float]:
        for name, weight in value.items():
            if name not in CRITERIA:
                raise ValueError(f"Critère inconnu : {name}")
            if not 0 <= weight <= 1:
                raise ValueError(f"Poids hors bornes [0,1] : {name}={weight}")
        return value


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    criteria: dict
    weights: dict[str, float]
    active_criteria_count: int
    created_at: datetime
    updated_at: datetime


class ProjectPage(BaseModel):
    items: list[ProjectRead]
    total: int
    page: int
    page_size: int
    total_pages: int
