"""LES formules de scoring (CDC §6.2–6.3) — module PUR, sans I/O, testé en golden tests.

[NE PAS REPRODUIRE] P2 v1 : 3 implémentations divergentes. Ici : l'unique source de
vérité, appelée par l'API, les recommandations de projets (J4) et jamais recalculée
au front (P3). Tous les scores sont dans [0, 1].
"""

import math
from dataclasses import dataclass
from typing import Any

from ibis.modules.datasets.ethics import ethical_score as compute_ethical_score

# Les 12 critères scorables (CDC §6.3) — l'ordre est celui de la heatmap.
CRITERIA: tuple[str, ...] = (
    "ethical_score",
    "technical_score",
    "popularity_score",
    "anonymization",
    "transparency",
    "informed_consent",
    "documentation",
    "data_quality",
    "instances_count",
    "features_count",
    "year",
    "sample_balance",
)

# Poids par défaut si aucun fourni (CDC §6.3)
DEFAULT_WEIGHTS: dict[str, float] = {
    "ethical_score": 0.4,
    "technical_score": 0.4,
    "popularity_score": 0.2,
}

# Profils de pondération prédéfinis (CDC §6.4) — choix produit documentés
PROFILES: dict[str, dict[str, float]] = {
    "academic_research": {
        "ethical_score": 0.45,
        "technical_score": 0.25,
        "documentation": 0.15,
        "popularity_score": 0.15,
    },
    "industrial_application": {
        "technical_score": 0.4,
        "data_quality": 0.25,
        "instances_count": 0.2,
        "popularity_score": 0.15,
    },
    "rapid_prototyping": {
        "technical_score": 0.3,
        "data_quality": 0.25,
        "instances_count": 0.15,
        "features_count": 0.15,
        "year": 0.15,
    },
}


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


@dataclass(frozen=True)
class DatasetFacts:
    """Les faits d'un dataset nécessaires au scoring (découplé de SQLAlchemy)."""

    ethical_values: dict[str, bool | None]
    metadata_provided_with_dataset: bool | None
    external_documentation_available: bool | None
    has_missing_values: bool | None
    global_missing_percentage: float | None
    split: bool | None
    instances_number: int | None
    features_number: int | None
    num_citations: int
    year: int | None
    sample_balance_level: str | None
    anonymization_applied: bool | None
    transparency: bool | None
    informed_consent: bool | None

    @classmethod
    def from_dataset(cls, dataset: Any) -> "DatasetFacts":
        return cls(
            ethical_values=dataset.ethical_values(),
            metadata_provided_with_dataset=dataset.metadata_provided_with_dataset,
            external_documentation_available=dataset.external_documentation_available,
            has_missing_values=dataset.has_missing_values,
            global_missing_percentage=dataset.global_missing_percentage,
            split=dataset.split,
            instances_number=dataset.instances_number,
            features_number=dataset.features_number,
            num_citations=dataset.num_citations or 0,
            year=dataset.year,
            sample_balance_level=dataset.sample_balance_level,
            anonymization_applied=dataset.anonymization_applied,
            transparency=dataset.transparency,
            informed_consent=dataset.informed_consent,
        )


# --------------------------- Scores élémentaires (CDC §6.2) ---------------------------------


def ethical_score(facts: DatasetFacts) -> float:
    """(nb critères True) / 10 — null et false comptent 0."""
    return compute_ethical_score(facts.ethical_values)


def _instances_component(n: int) -> float:
    """clamp((log10(n) − 2) / 3) : 0 sous 100 lignes, 1 dès 100 000."""
    if n <= 0:
        return 0.0
    return clamp((math.log10(n) - 2) / 3)


def _features_component(f: int) -> float:
    """Optimal 10–100 → 1 ; < 10 → f/10 ; > 100 → max(0.5, 1 − (f−100)/1000)."""
    if f < 10:
        return clamp(f / 10)
    if f <= 100:
        return 1.0
    return max(0.5, 1 - (f - 100) / 1000)


def technical_score(facts: DatasetFacts) -> float:
    """Somme pondérée NORMALISÉE DYNAMIQUEMENT sur les seuls critères renseignés.

    Un champ None est exclu du numérateur ET du dénominateur (CDC §6.2).
    """
    components: list[tuple[float, float]] = []  # (score, poids)

    if facts.metadata_provided_with_dataset is not None:
        components.append((1.0 if facts.metadata_provided_with_dataset else 0.0, 0.15))
    if facts.external_documentation_available is not None:
        components.append((1.0 if facts.external_documentation_available else 0.0, 0.15))
    if facts.has_missing_values is not None:
        if not facts.has_missing_values:
            components.append((1.0, 0.20))
        elif facts.global_missing_percentage is not None:
            components.append((clamp((100 - facts.global_missing_percentage) / 100), 0.20))
        # has_missing=True sans pourcentage connu → composante non évaluable, exclue
    if facts.split is not None:
        components.append((1.0 if facts.split else 0.0, 0.20))
    if facts.instances_number is not None:
        components.append((_instances_component(facts.instances_number), 0.15))
    if facts.features_number is not None:
        components.append((_features_component(facts.features_number), 0.15))

    total_weight = sum(weight for _, weight in components)
    if total_weight == 0:
        return 0.0
    return sum(score * weight for score, weight in components) / total_weight


def popularity_score(facts: DatasetFacts) -> float:
    """clamp(log10(citations) / 3) — 0 si ≤ 0, 1 dès 1000."""
    if facts.num_citations <= 0:
        return 0.0
    return clamp(math.log10(facts.num_citations) / 3)


# --------------------------- Les 12 sous-scores (CDC §6.3) ----------------------------------


def criterion_scores(facts: DatasetFacts) -> dict[str, float]:
    """La décomposition complète — source unique de la heatmap (P3)."""
    if facts.has_missing_values is False:
        data_quality = 1.0
    elif facts.has_missing_values is True and facts.global_missing_percentage is not None:
        data_quality = clamp((100 - facts.global_missing_percentage) / 100)
    else:
        data_quality = 0.5  # inconnu (CDC §6.3)

    documentation = (
        1.0
        if (facts.metadata_provided_with_dataset or facts.external_documentation_available)
        else 0.0
    )

    balance_map = {
        "balanced": 1.0,
        "moderate": 0.66,
        "imbalanced": 0.33,
        "severely_imbalanced": 0.0,
    }
    # Équilibre inconnu → 0.5 neutre (même convention que data_quality inconnue)
    sample_balance = balance_map.get(facts.sample_balance_level or "", 0.5)

    instances = facts.instances_number or 0
    features = facts.features_number or 0

    return {
        "ethical_score": round(ethical_score(facts), 4),
        "technical_score": round(technical_score(facts), 4),
        "popularity_score": round(popularity_score(facts), 4),
        "anonymization": 1.0 if facts.anonymization_applied is True else 0.0,
        "transparency": 1.0 if facts.transparency is True else 0.0,
        "informed_consent": 1.0 if facts.informed_consent is True else 0.0,
        "documentation": documentation,
        "data_quality": round(data_quality, 4),
        "instances_count": round(min(1.0, math.log10(max(1, instances)) / 5), 4),
        "features_count": round(min(1.0, features / 100), 4),
        "year": round(clamp(((facts.year or 2000) - 2000) / 25), 4),
        "sample_balance": sample_balance,
    }


def weighted_score(scores: dict[str, float], weights: dict[str, float]) -> float:
    """score_final = Σ(score_i × poids_i) / Σ(poids_i) — CDC §6.3."""
    applicable = {name: weight for name, weight in weights.items() if weight > 0}
    if not applicable:
        applicable = dict(DEFAULT_WEIGHTS)
    total = sum(applicable.values())
    return sum(scores[name] * weight for name, weight in applicable.items()) / total


def normalize_weights(weights: dict[str, float]) -> dict[str, float]:
    """Poids effectifs normalisés (pour affichage du % effectif — CDC §6.4)."""
    total = sum(w for w in weights.values() if w > 0)
    if total <= 0:
        return {}
    return {name: round(weight / total, 4) for name, weight in weights.items() if weight > 0}
