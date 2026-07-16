"""Golden tests des formules de scoring (CDC §6.2–6.3) — valeurs calculées à la main."""

import pytest

from ibis.modules.scoring import formulas
from ibis.modules.scoring.formulas import DatasetFacts


def facts(**overrides: object) -> DatasetFacts:
    base: dict = {
        "ethical_values": dict.fromkeys(
            (
                "informed_consent",
                "transparency",
                "user_control",
                "equity_non_discrimination",
                "security_measures_in_place",
                "data_quality_documented",
                "anonymization_applied",
                "record_keeping_policy_exists",
                "purpose_limitation_respected",
                "accountability_defined",
            )
        ),
        "metadata_provided_with_dataset": None,
        "external_documentation_available": None,
        "has_missing_values": None,
        "global_missing_percentage": None,
        "split": None,
        "instances_number": None,
        "features_number": None,
        "num_citations": 0,
        "year": None,
        "sample_balance_level": None,
        "anonymization_applied": None,
        "transparency": None,
        "informed_consent": None,
    }
    base.update(overrides)
    return DatasetFacts(**base)


# --------------------------- Score éthique ----------------------------------------------------


def test_ethical_score_granularity() -> None:
    """1 critère True = 10 % ; null et false comptent 0 (CDC §6.2)."""
    empty = facts()
    assert formulas.ethical_score(empty) == 0.0
    three_true = facts(
        ethical_values={
            **empty.ethical_values,
            "transparency": True,
            "informed_consent": True,
            "anonymization_applied": True,
            "user_control": False,  # évalué absent → 0
        }
    )
    assert formulas.ethical_score(three_true) == pytest.approx(0.3)


# --------------------------- Score technique --------------------------------------------------


def test_technical_normalizes_on_known_fields_only() -> None:
    """Un champ null est exclu du numérateur ET du dénominateur."""
    only_split = facts(split=True)
    assert formulas.technical_score(only_split) == pytest.approx(1.0)  # 1×0.2 / 0.2

    split_and_docs = facts(split=True, metadata_provided_with_dataset=False)
    # (1×0.2 + 0×0.15) / 0.35
    assert formulas.technical_score(split_and_docs) == pytest.approx(0.2 / 0.35)


def test_technical_instances_log_curve() -> None:
    assert formulas._instances_component(100) == pytest.approx(0.0)
    assert formulas._instances_component(1000) == pytest.approx(1 / 3)
    assert formulas._instances_component(100_000) == pytest.approx(1.0)
    assert formulas._instances_component(1_000_000) == pytest.approx(1.0)  # clamp
    assert formulas._instances_component(50) == pytest.approx(0.0)  # clamp bas
    assert formulas._instances_component(0) == 0.0


def test_technical_features_optimum() -> None:
    assert formulas._features_component(5) == pytest.approx(0.5)
    assert formulas._features_component(10) == pytest.approx(1.0)
    assert formulas._features_component(100) == pytest.approx(1.0)
    assert formulas._features_component(600) == pytest.approx(0.5)  # 1−0.5
    assert formulas._features_component(1100) == pytest.approx(0.5)  # plancher 0.5


def test_technical_missing_values_component() -> None:
    clean = facts(has_missing_values=False)
    assert formulas.technical_score(clean) == pytest.approx(1.0)  # 1×0.2/0.2
    dirty = facts(has_missing_values=True, global_missing_percentage=30.0)
    assert formulas.technical_score(dirty) == pytest.approx(0.7)  # (0.7×0.2)/0.2
    unknown_pct = facts(has_missing_values=True)  # % inconnu → composante exclue
    assert formulas.technical_score(unknown_pct) == 0.0


def test_technical_full_example_hand_computed() -> None:
    """Exemple complet : split + docs + manquants 10 % + 1000 lignes + 50 colonnes."""
    example = facts(
        metadata_provided_with_dataset=True,  # 1 × 0.15
        external_documentation_available=False,  # 0 × 0.15
        has_missing_values=True,
        global_missing_percentage=10.0,  # 0.9 × 0.20
        split=True,  # 1 × 0.20
        instances_number=1000,  # (1/3) × 0.15
        features_number=50,  # 1 × 0.15
    )
    expected = (0.15 + 0.0 + 0.18 + 0.20 + 0.05 + 0.15) / 1.0
    assert formulas.technical_score(example) == pytest.approx(expected)


# --------------------------- Popularité & 12 critères -----------------------------------------


def test_popularity_log_curve() -> None:
    assert formulas.popularity_score(facts(num_citations=0)) == 0.0
    assert formulas.popularity_score(facts(num_citations=10)) == pytest.approx(1 / 3)
    assert formulas.popularity_score(facts(num_citations=1000)) == pytest.approx(1.0)
    assert formulas.popularity_score(facts(num_citations=100_000)) == pytest.approx(1.0)


def test_criterion_scores_decomposition() -> None:
    example = facts(
        transparency=True,
        anonymization_applied=True,
        has_missing_values=True,
        global_missing_percentage=20.0,
        instances_number=100_000,  # log10=5 → /5 = 1
        features_number=25,  # 25/100
        year=2020,  # (2020−2000)/25 = 0.8
        sample_balance_level="moderate",
        metadata_provided_with_dataset=True,
    )
    scores = formulas.criterion_scores(example)
    assert set(scores) == set(formulas.CRITERIA)
    assert scores["anonymization"] == 1.0
    assert scores["transparency"] == 1.0
    assert scores["informed_consent"] == 0.0
    assert scores["documentation"] == 1.0
    assert scores["data_quality"] == pytest.approx(0.8)
    assert scores["instances_count"] == pytest.approx(1.0)
    assert scores["features_count"] == pytest.approx(0.25)
    assert scores["year"] == pytest.approx(0.8)
    assert scores["sample_balance"] == pytest.approx(0.66)


def test_criterion_unknowns_conventions() -> None:
    scores = formulas.criterion_scores(facts())
    assert scores["data_quality"] == 0.5  # inconnu → 0.5 (CDC §6.3)
    assert scores["sample_balance"] == 0.5  # convention documentée
    assert scores["year"] == 0.0
    assert scores["instances_count"] == 0.0


# --------------------------- Score final pondéré ----------------------------------------------


def test_weighted_score_hand_computed() -> None:
    scores = dict.fromkeys(formulas.CRITERIA, 0.0)
    scores.update({"ethical_score": 0.8, "technical_score": 0.5, "popularity_score": 1.0})
    weights = {"ethical_score": 0.5, "technical_score": 0.25, "popularity_score": 0.25}
    expected = (0.8 * 0.5 + 0.5 * 0.25 + 1.0 * 0.25) / 1.0
    assert formulas.weighted_score(scores, weights) == pytest.approx(expected)


def test_weighted_score_normalizes_any_sum() -> None:
    """Σ poids ≠ 1 → normalisation implicite par Σ(poids)."""
    scores = dict.fromkeys(formulas.CRITERIA, 0.0)
    scores.update({"ethical_score": 1.0, "technical_score": 0.0})
    doubled = {"ethical_score": 0.8, "technical_score": 0.8}
    assert formulas.weighted_score(scores, doubled) == pytest.approx(0.5)


def test_default_weights_applied_when_empty() -> None:
    scores = dict.fromkeys(formulas.CRITERIA, 0.0)
    scores.update({"ethical_score": 1.0, "technical_score": 0.5, "popularity_score": 0.0})
    expected = (1.0 * 0.4 + 0.5 * 0.4 + 0.0 * 0.2) / 1.0
    assert formulas.weighted_score(scores, {}) == pytest.approx(expected)


def test_normalize_weights_display() -> None:
    assert formulas.normalize_weights({"ethical_score": 0.5, "technical_score": 0.5}) == {
        "ethical_score": 0.5,
        "technical_score": 0.5,
    }
    assert formulas.normalize_weights({"ethical_score": 0.2, "technical_score": 0.6}) == {
        "ethical_score": 0.25,
        "technical_score": 0.75,
    }


def test_profiles_reference_known_criteria() -> None:
    for name, weights in formulas.PROFILES.items():
        assert weights, name
        for criterion in weights:
            assert criterion in formulas.CRITERIA
