"""Modèles du catalogue (CDC §5.2, ARCH §6.2) : datasets, fichiers, colonnes, templates."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import BigInteger, Boolean, Float, ForeignKey, Integer, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ibis.db.base import Base, Timestamped, UUIDPk

if TYPE_CHECKING:  # évite un import circulaire auth <-> datasets à l'exécution
    from ibis.modules.auth.models import User


class Dataset(UUIDPk, Timestamped, Base):
    __tablename__ = "datasets"

    # --- Identification & documentation ---
    dataset_name: Mapped[str] = mapped_column(String(120), unique=True, index=True)  # slug
    display_name: Mapped[str] = mapped_column(String(255), index=True)
    year: Mapped[int | None] = mapped_column(SmallInteger)
    objective: Mapped[str | None] = mapped_column(Text)
    sources: Mapped[str | None] = mapped_column(Text)
    storage_uri: Mapped[str | None] = mapped_column(String(512))  # lien externe (ex. Kaggle)
    documentation_link: Mapped[str | None] = mapped_column(String(512))
    citation_link: Mapped[str | None] = mapped_column(String(512))
    num_citations: Mapped[int] = mapped_column(Integer, default=0)
    access: Mapped[str] = mapped_column(String(20), default="public")  # public | private
    availability: Mapped[str | None] = mapped_column(String(50))
    metadata_provided_with_dataset: Mapped[bool | None] = mapped_column(Boolean)
    external_documentation_available: Mapped[bool | None] = mapped_column(Boolean)

    # --- Caractéristiques techniques ---
    instances_number: Mapped[int | None] = mapped_column(BigInteger)
    features_number: Mapped[int | None] = mapped_column(Integer)
    features_description: Mapped[str | None] = mapped_column(Text)
    domain: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    task: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    split: Mapped[bool | None] = mapped_column(Boolean)
    temporal_factors: Mapped[bool | None] = mapped_column(Boolean)
    has_missing_values: Mapped[bool | None] = mapped_column(Boolean)
    global_missing_percentage: Mapped[float | None] = mapped_column(Float)
    missing_values_description: Mapped[str | None] = mapped_column(Text)
    missing_values_handling_method: Mapped[str | None] = mapped_column(String(120))
    representativity_level: Mapped[str | None] = mapped_column(String(20))  # high|medium|low
    representativity_description: Mapped[str | None] = mapped_column(Text)
    sample_balance_level: Mapped[str | None] = mapped_column(String(30))
    sample_balance_description: Mapped[str | None] = mapped_column(Text)

    # --- Les 10 critères éthiques (tristate — ethics.ETHICAL_CRITERIA) ---
    informed_consent: Mapped[bool | None] = mapped_column(Boolean)
    transparency: Mapped[bool | None] = mapped_column(Boolean)
    user_control: Mapped[bool | None] = mapped_column(Boolean)
    equity_non_discrimination: Mapped[bool | None] = mapped_column(Boolean)
    security_measures_in_place: Mapped[bool | None] = mapped_column(Boolean)
    data_quality_documented: Mapped[bool | None] = mapped_column(Boolean)
    anonymization_applied: Mapped[bool | None] = mapped_column(Boolean)
    record_keeping_policy_exists: Mapped[bool | None] = mapped_column(Boolean)
    purpose_limitation_respected: Mapped[bool | None] = mapped_column(Boolean)
    accountability_defined: Mapped[bool | None] = mapped_column(Boolean)

    # Guide IA (généré à la demande, M2) : {text, model_used, is_fallback, language, generated_at}
    ai_guide: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    # NULL = import système ; la suppression d'un compte rend ses datasets « système »
    # (le catalogue est partagé — seule l'administration peut alors les gérer).
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )

    # --- Provenance & confiance (import communautaire) ---
    # `upload` (multipart) | `seed` (YAML embarqué) | `kaggle` (lien collé).
    source_kind: Mapped[str] = mapped_column(String(20), default="upload")
    # Clé de déduplication, ex. « kaggle:uciml/iris ». L'unicité est PARTIELLE (index
    # `uq_datasets_source_ref_public`, seulement sur access='public') : le catalogue public
    # n'a jamais deux fois le même jeu, mais chacun garde le droit d'en avoir une copie privée.
    source_ref: Mapped[str | None] = mapped_column(String(160), index=True)
    license_name: Mapped[str | None] = mapped_column(String(160))
    # Badge « Vérifié IBIS-X » — vrai pour le catalogue curé, faux pour les imports communautaires.
    # Explicite plutôt que déduit de `created_by IS NULL` (zone d'ombre levée, spec §Questions).
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    # --- Éthique : suggéré ≠ vérifié ---
    # Les 10 critères ci-dessus restent NULL tant qu'un HUMAIN n'a pas tranché. Les propositions
    # de l'IA vivent ici, séparées, et ne comptent jamais dans le score éthique.
    ethics_suggestions: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    ethics_reviewed_at: Mapped[datetime | None] = mapped_column()
    ethics_reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    # `selectin` : la carte catalogue affiche l'attribution, donc l'owner est TOUJOURS lu.
    # Le charger avec la liste évite une requête par ligne (N+1) sur une page de 96 résultats.
    owner: Mapped["User | None"] = relationship("User", foreign_keys=[created_by], lazy="selectin")

    files: Mapped[list["DatasetFile"]] = relationship(
        back_populates="dataset", cascade="all, delete-orphan", order_by="DatasetFile.created_at"
    )

    def ethical_values(self) -> dict[str, bool | None]:
        from ibis.modules.datasets.ethics import ETHICAL_CRITERIA

        return {name: getattr(self, name) for name in ETHICAL_CRITERIA}


class DatasetFile(UUIDPk, Timestamped, Base):
    __tablename__ = "dataset_files"

    dataset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("datasets.id", ondelete="CASCADE"), index=True
    )
    original_filename: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(512))  # datasets/{id}/{uuid}.parquet
    logical_role: Mapped[str] = mapped_column(String(20), default="data_file")
    format: Mapped[str] = mapped_column(String(20), default="parquet")  # format canonique
    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    row_count: Mapped[int] = mapped_column(BigInteger, default=0)

    dataset: Mapped[Dataset] = relationship(back_populates="files")
    columns: Mapped[list["DatasetColumn"]] = relationship(
        back_populates="file", cascade="all, delete-orphan", order_by="DatasetColumn.position"
    )


class DatasetColumn(UUIDPk, Base):
    __tablename__ = "dataset_columns"

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dataset_files.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    dtype_original: Mapped[str] = mapped_column(String(50))
    dtype_interpreted: Mapped[str] = mapped_column(
        String(20)
    )  # numerical|categorical|text|datetime|boolean
    is_nullable: Mapped[bool] = mapped_column(Boolean, default=False)
    is_pii: Mapped[bool] = mapped_column(Boolean, default=False)
    example_values: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    position: Mapped[int] = mapped_column(SmallInteger, default=0)
    stats: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    file: Mapped[DatasetFile] = relationship(back_populates="columns")


class EthicalTemplate(UUIDPk, Timestamped, Base):
    """Valeurs éthiques par défaut par domaine (M8) — en base, PAS en YAML (v1)."""

    __tablename__ = "ethical_templates"

    domain: Mapped[str] = mapped_column(String(50), unique=True)
    defaults: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))


class QualityAnalysis(UUIDPk, Timestamped, Base):
    """Cache 7 j de l'analyse qualité (CDC §8.2 É3) — rempli au J5."""

    __tablename__ = "quality_analyses"

    dataset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("datasets.id", ondelete="CASCADE"), unique=True
    )
    analysis: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    quality_score: Mapped[int] = mapped_column(SmallInteger, default=0)
    column_recommendations: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    computed_at: Mapped[datetime | None] = mapped_column()
    expires_at: Mapped[datetime | None] = mapped_column()
