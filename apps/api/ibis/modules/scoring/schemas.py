"""Schemas du scoring (CDC §6.5)."""

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ibis.modules.datasets.schemas import DatasetCard, DatasetFilters
from ibis.modules.scoring.formulas import CRITERIA


class CriterionWeight(BaseModel):
    model_config = ConfigDict(extra="forbid")

    criterion_name: str
    weight: float = Field(ge=0, le=1)

    @field_validator("criterion_name")
    @classmethod
    def known_criterion(cls, value: str) -> str:
        if value not in CRITERIA:
            raise ValueError(f"Critère inconnu : {value} (attendus : {', '.join(CRITERIA)})")
        return value


class ScoreRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filters: DatasetFilters | None = None
    weights: list[CriterionWeight] = Field(default_factory=list)


class ScoredDataset(BaseModel):
    dataset: DatasetCard
    score: float
    rank: int
    criterion_scores: dict[str, float]


class ScoreResponse(BaseModel):
    results: list[ScoredDataset]
    effective_weights: dict[str, float]  # % effectifs normalisés (affichage)
    criteria: list[str]  # ordre canonique des colonnes de la heatmap


class ScoringProfile(BaseModel):
    name: str
    weights: dict[str, float]


class ProfilesResponse(BaseModel):
    profiles: list[ScoringProfile]
    default_weights: dict[str, float]
    criteria: list[str]
