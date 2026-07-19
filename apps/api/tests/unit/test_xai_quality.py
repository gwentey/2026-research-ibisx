"""Unitaires : les 6 KPI de qualité XAI sur cas construits (CDC §9.3) + anti-hallucination."""

import pytest

from ibis.modules.llm import xai_text
from ibis.modules.xai import quality

# --------------------------- Complétude SHAP (axiome d'efficience) ---------------------------


def test_shap_completeness_satisfied() -> None:
    """Σφᵢ + base = prédiction exactement → erreur 0, satisfait."""
    result = quality.shap_completeness([0.2, 0.3, -0.1], base_value=0.5, prediction=0.9)
    assert result["error"] == pytest.approx(0.0, abs=1e-9)
    assert result["satisfied"] is True


def test_shap_completeness_violated() -> None:
    result = quality.shap_completeness([0.2, 0.2], base_value=0.5, prediction=1.5)
    assert result["error"] == pytest.approx(0.6 / 1.5)
    assert result["satisfied"] is False


# --------------------------- Stabilité (Spearman des classements) ----------------------------


def test_stability_perfect_and_degraded() -> None:
    ranking = ["a", "b", "c", "d", "e"]
    perfect = quality.rank_stability([ranking, ranking, ranking])
    assert perfect is not None
    assert perfect["spearman_mean"] == pytest.approx(1.0)
    assert perfect["label"] == "very_stable"

    reversed_ranking = list(reversed(ranking))
    degraded = quality.rank_stability([ranking, reversed_ranking])
    assert degraded is not None
    assert degraded["spearman_mean"] == pytest.approx(-1.0)
    assert degraded["label"] == "unstable"


def test_stability_not_computable_is_absent() -> None:
    """P1 : incalculable → None (absent), jamais de valeur par défaut."""
    assert quality.rank_stability([["a", "b"]]) is None
    assert quality.rank_stability([["a", "b"], ["c", "d"]]) is None  # aucun commun


# --------------------------- Accord inter-méthodes -------------------------------------------


def test_inter_method_agreement() -> None:
    shap_ranking = ["a", "b", "c", "d"]
    same = quality.inter_method_agreement(shap_ranking, ["a", "b", "c", "d"])
    assert same is not None
    assert same["spearman"] == pytest.approx(1.0)

    inverted = quality.inter_method_agreement(shap_ranking, ["d", "c", "b", "a"])
    assert inverted is not None
    assert inverted["spearman"] == pytest.approx(-1.0)
    assert quality.inter_method_agreement(["a", "b", "c"], ["x", "y", "z"]) is None


# --------------------------- Parcimonie ------------------------------------------------------


def test_parsimony_smallest_k_for_80_percent() -> None:
    # 0.5 + 0.3 = 0.8 → k=2 sur 4
    result = quality.parsimony([0.5, 0.3, 0.15, 0.05])
    assert result is not None
    assert result["k"] == 2
    concentrated = quality.parsimony([0.9, 0.05, 0.05])
    assert concentrated is not None
    assert concentrated["k"] == 1
    assert quality.parsimony([0.0, 0.0]) is None


# --------------------------- Fidélité LIME ---------------------------------------------------


def test_lime_fidelity_labels() -> None:
    high = quality.lime_fidelity(0.92)
    assert high is not None and high["label"] == "high"
    medium = quality.lime_fidelity(0.6)
    assert medium is not None and medium["label"] == "medium"
    low = quality.lime_fidelity(0.2)
    assert low is not None and low["label"] == "low"
    assert quality.lime_fidelity(None) is None


# --------------------------- Anti-hallucination (CDC §9.5) -----------------------------------


def test_numbers_validation_accepts_context_numbers() -> None:
    context = "Métriques réelles : f1_macro=0.8997, accuracy=0.9\nImportances : petal_length=0.45"
    ok = "Le modèle atteint un F1-macro de 0.8997 (soit 89.97 %) et petal_length pèse 0.45."
    assert xai_text.numbers_exist_in_context(ok, context) is True


def test_numbers_validation_rejects_invented() -> None:
    context = "Métriques réelles : accuracy=0.9"
    invented = "Le modèle atteint 97,3 % de précision."
    assert xai_text.numbers_exist_in_context(invented, context) is False


def test_numbers_validation_accepts_high_precision_context_echo() -> None:
    # Régression : une importance SHAP à pleine précision (>4 décimales), recopiée telle
    # quelle par l'IA, ne doit PAS être vue comme une hallucination (elle EST dans le contexte).
    context = "Importances : Sex_female=0.242421, Pclass=0.126984, Age=0.050806"
    echoed = "Sex_female pèse 0.242421, devant Pclass (0.126984) et Age (0.050806)."
    assert xai_text.numbers_exist_in_context(echoed, context) is True


def test_fallback_text_uses_only_real_values() -> None:
    text = xai_text.fallback_text(
        audience="novice",
        language="fr",
        metrics={"primary_metric": "f1_macro", "f1_macro": 0.85},
        importance=[{"feature": "petal_length", "value": 0.5}],
        task_type="classification",
        algorithm="random_forest",
    )
    assert "random_forest" in text
    assert "0.85" in text
    assert "petal_length" in text
    assert "sans IA" in text  # honnêteté P2


def test_suggested_questions_contextual() -> None:
    classif = xai_text.suggested_questions("classification", "fr")
    assert any("confusion" in q for q in classif)
    regression = xai_text.suggested_questions("regression", "en")
    assert any("MAE" in q for q in regression)
    assert len(classif) == 4
