"""Schemas Pydantic du catalogue — filtres exhaustifs (CDC §5.3) et lectures."""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ibis.modules.datasets.ethics import ETHICAL_CRITERIA
from ibis.modules.jobs.schemas import JobRead

SortKey = Literal["name", "year", "instances", "features", "citations", "created", "updated"]
SortOrder = Literal["asc", "desc"]
PageSize = Literal[12, 24, 48, 96]
Tristate = bool | None


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DatasetFilters(StrictModel):
    """Filtres du catalogue — tous appliqués côté backend (CDC §5.3)."""

    q: str | None = Field(default=None, max_length=200)
    domains: list[str] | None = None  # containment : TOUS les domaines cochés
    tasks: list[str] | None = None
    instances_min: int | None = Field(default=None, ge=0)
    instances_max: int | None = Field(default=None, ge=0)
    features_min: int | None = Field(default=None, ge=0)
    features_max: int | None = Field(default=None, ge=0)
    year_min: int | None = Field(default=None, ge=1900)
    year_max: int | None = Field(default=None, le=2100)
    citations_min: int | None = Field(default=None, ge=0)
    citations_max: int | None = Field(default=None, ge=0)
    ethical_score_min: int | None = Field(default=None, ge=0, le=100)
    split: bool | None = None
    anonymized: bool | None = None
    temporal: bool | None = None
    public: bool | None = None
    representativity_level: Literal["high", "medium", "low"] | None = None
    has_missing_values: Tristate = None
    # Éthique avancée : un toggle par critère (filtre si True)
    informed_consent: bool | None = None
    transparency: bool | None = None
    user_control: bool | None = None
    equity_non_discrimination: bool | None = None
    security_measures_in_place: bool | None = None
    data_quality_documented: bool | None = None
    anonymization_applied: bool | None = None
    record_keeping_policy_exists: bool | None = None
    purpose_limitation_respected: bool | None = None
    accountability_defined: bool | None = None


class DatasetListQuery(DatasetFilters):
    """Filtres + tri + pagination en UN modèle de query.

    (FastAPI ne parse pas correctement un modèle Query mélangé à des scalaires.)
    """

    sort_by: SortKey = "name"
    sort_order: SortOrder = "asc"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=24, ge=1, le=96)


class ColumnRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    dtype_original: str
    dtype_interpreted: str
    is_nullable: bool
    is_pii: bool
    example_values: list[str]
    position: int
    stats: dict[str, Any]


class FileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    original_filename: str
    logical_role: str
    format: str
    size_bytes: int
    row_count: int


class FileWithColumns(FileRead):
    columns: list[ColumnRead]


class DatasetOwner(BaseModel):
    """Attribution publique d'un dataset importé — jamais l'email, seulement le pseudo."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    pseudo: str | None
    has_avatar: bool


class DatasetCard(BaseModel):
    """Résumé pour les cartes/tableau du catalogue."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    dataset_name: str
    display_name: str
    year: int | None
    objective: str | None
    access: str
    num_citations: int
    instances_number: int | None
    features_number: int | None
    domain: list[str]
    task: list[str]
    split: bool | None
    temporal_factors: bool | None
    anonymization_applied: bool | None
    has_missing_values: bool | None
    global_missing_percentage: float | None
    representativity_level: str | None
    ethical_score: float  # ∈ [0,1] — calculé backend, jamais recalculé au front (P3)
    created_by: uuid.UUID | None
    # Qui a importé — l'attribution est le garde-fou social contre les imports fantaisistes.
    owner: DatasetOwner | None = None
    is_verified: bool = False  # badge « Vérifié IBIS-X » vs « Communauté »
    source_kind: str = "upload"
    license_name: str | None = None
    created_at: datetime
    updated_at: datetime


class DatasetDetail(DatasetCard):
    sources: str | None
    storage_uri: str | None
    documentation_link: str | None
    citation_link: str | None
    availability: str | None
    metadata_provided_with_dataset: bool | None
    external_documentation_available: bool | None
    features_description: str | None
    missing_values_description: str | None
    missing_values_handling_method: str | None
    representativity_description: str | None
    sample_balance_level: str | None
    sample_balance_description: str | None
    ethical_criteria: dict[str, bool | None]  # tristate VISIBLE (CDC §5.4)
    completeness: float | None  # 100 − % manquants (métrique réelle uniquement)
    ai_guide: dict[str, Any] | None
    # Propositions de l'IA pour les 10 critères — SÉPARÉES des valeurs retenues ci-dessus,
    # affichées comme « à confirmer » et jamais comptées dans `ethical_score`.
    ethics_suggestions: dict[str, Any] | None = None
    ethics_reviewed_at: datetime | None = None
    source_ref: str | None = None
    files: list[FileWithColumns]


class DatasetPage(BaseModel):
    items: list[DatasetCard]
    total: int
    page: int
    page_size: int
    total_pages: int


class FacetValue(BaseModel):
    value: str
    count: int


class DatasetFacets(BaseModel):
    domains: list[FacetValue]
    tasks: list[FacetValue]
    instances_max: int
    features_max: int
    year_min: int
    year_max: int
    citations_max: int


class CatalogStats(BaseModel):
    total_datasets: int
    total_instances: int
    average_features: float | None
    domain_distribution: list[FacetValue]
    task_distribution: list[FacetValue]


class PreviewColumnStats(BaseModel):
    name: str
    dtype_interpreted: str
    stats: dict[str, Any]


class DatasetPreview(BaseModel):
    """Échantillon RÉEL (random_state=42) — jamais simulé (P1)."""

    file_id: uuid.UUID
    original_filename: str
    total_rows: int
    total_columns: int
    displayed_columns: list[str]
    rows: list[dict[str, Any]]
    column_stats: list[PreviewColumnStats]
    sampled: bool
    random_state: int


class UploadFileAnalysis(BaseModel):
    original_filename: str
    row_count: int
    column_count: int
    missing_percentage: float
    columns: list[dict[str, Any]]
    preview_rows: list[dict[str, Any]]


class UploadAnalysis(BaseModel):
    """Analyse pré-upload SANS persistance (CDC §5.5.b)."""

    files: list[UploadFileAnalysis]
    suggested_name: str
    suggested_domains: list[str]
    suggested_tasks: list[str]
    indicative_quality_score: int


class DatasetMetadataInput(StrictModel):
    """Métadonnées à la création/édition (les champs calculés sont exclus)."""

    display_name: str = Field(min_length=1, max_length=255)
    dataset_name: str | None = Field(default=None, max_length=120)
    year: int | None = Field(default=None, ge=1900, le=2100)
    objective: str | None = None
    sources: str | None = None
    storage_uri: str | None = Field(default=None, max_length=512)
    documentation_link: str | None = Field(default=None, max_length=512)
    citation_link: str | None = Field(default=None, max_length=512)
    num_citations: int = Field(default=0, ge=0)
    access: Literal["public", "private"] = "public"
    availability: str | None = Field(default=None, max_length=50)
    metadata_provided_with_dataset: bool | None = None
    external_documentation_available: bool | None = None
    features_description: str | None = None
    domain: list[str] = Field(default_factory=list)
    task: list[str] = Field(default_factory=list)
    split: bool | None = None
    temporal_factors: bool | None = None
    missing_values_description: str | None = None
    missing_values_handling_method: str | None = Field(default=None, max_length=120)
    representativity_level: Literal["high", "medium", "low"] | None = None
    representativity_description: str | None = None
    sample_balance_level: (
        Literal["balanced", "moderate", "imbalanced", "severely_imbalanced"] | None
    ) = None
    sample_balance_description: str | None = None
    informed_consent: bool | None = None
    transparency: bool | None = None
    user_control: bool | None = None
    equity_non_discrimination: bool | None = None
    security_measures_in_place: bool | None = None
    data_quality_documented: bool | None = None
    anonymization_applied: bool | None = None
    record_keeping_policy_exists: bool | None = None
    purpose_limitation_respected: bool | None = None
    accountability_defined: bool | None = None


class KaggleImportRequest(StrictModel):
    """Import depuis un lien Kaggle collé par l'utilisateur."""

    url: str = Field(min_length=1, max_length=500)
    #: Souhait de l'utilisateur — une licence non redistribuable peut le dégrader en `private`.
    access: Literal["public", "private"] = "public"


class KaggleImportResponse(BaseModel):
    """Réponse immédiate : soit un job lancé, soit le dataset déjà présent."""

    ref: str  # « uciml/iris »
    job: JobRead | None = None
    #: Renseignés quand le jeu existe déjà — le front redirige au lieu de créer un doublon.
    existing_dataset_id: uuid.UUID | None = None
    duplicate_reason: str | None = None


class EthicsReviewInput(StrictModel):
    """Validation HUMAINE des critères éthiques — seule à pouvoir peser sur le score.

    Revue partielle : un critère absent du dictionnaire n'est pas touché (on n'écrase pas
    en NULL ce que l'utilisateur n'a pas soumis). `None` explicite = « je ne tranche pas ».
    """

    values: dict[str, bool | None] = Field(default_factory=dict)

    @field_validator("values")
    @classmethod
    def only_known_criteria(cls, value: dict[str, bool | None]) -> dict[str, bool | None]:
        unknown = sorted(set(value) - set(ETHICAL_CRITERIA))
        if unknown:
            raise ValueError(f"Critère(s) éthique(s) inconnu(s) : {', '.join(unknown)}")
        return value


class DatasetMetadataUpdate(DatasetMetadataInput):
    display_name: str | None = Field(default=None, min_length=1, max_length=255)  # type: ignore[assignment]
    num_citations: int | None = Field(default=None, ge=0)  # type: ignore[assignment]
    access: Literal["public", "private"] | None = None  # type: ignore[assignment]


class CompletionSection(BaseModel):
    name: Literal["general", "technical", "ethical"]
    filled: int
    total: int
    missing_fields: list[str]


class CompletionStatus(BaseModel):
    overall_percentage: int
    sections: list[CompletionSection]
    needs_human_review: list[str]


class SimilarDataset(BaseModel):
    dataset: DatasetCard
    reason: Literal["domain_and_task", "domain", "task", "size"]


class AiGuideJob(BaseModel):
    job_id: uuid.UUID
