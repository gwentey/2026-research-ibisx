"""Unitaires : analyse qualité (matrice CDC), registre d'algos, évaluation, déterminisme."""

import numpy as np
import pandas as pd
import pytest

from ibis.core.errors import InvalidInputError
from ibis.modules.ml import algorithms as algo
from ibis.modules.ml import evaluation
from ibis.modules.ml.preprocessing import PreprocessingConfig, preprocess
from ibis.modules.ml.quality import analyze_dataframe, recommend_strategy


@pytest.mark.parametrize(
    ("missing", "numeric", "dist", "expected"),
    [
        (80, True, "normal", "drop_column"),
        (80, False, "categorical", "drop_column"),
        (50, True, "normal", "knn"),
        (50, False, "categorical", "most_frequent"),
        (25, True, "normal", "mean"),
        (25, True, "right_skewed", "median"),
        (25, False, "categorical", "most_frequent"),
        (5, True, "normal", "mean"),
        (5, True, "left_skewed", "median"),
        (5, False, "categorical", "most_frequent"),
    ],
)
def test_recommendation_matrix(missing: float, numeric: bool, dist: str, expected: str) -> None:
    """La matrice EXACTE du CDC §8.2 É3."""
    assert recommend_strategy(missing, numeric, dist) == expected


def test_quality_analysis_scores_and_columns() -> None:
    rng = np.random.RandomState(42)
    df = pd.DataFrame(
        {
            "clean": rng.normal(0, 1, 200),
            "holey": [None if i % 4 == 0 else float(i) for i in range(200)],  # 25 % manquants
            "cat": ["a", "b"] * 100,
        }
    )
    analysis = analyze_dataframe(df)
    assert analysis["row_count"] == 200
    by_name = {c["name"]: c for c in analysis["columns"]}
    assert by_name["holey"]["missing_percentage"] == 25.0
    assert by_name["holey"]["recommended_strategy"] in ("mean", "median")
    assert by_name["clean"]["recommended_strategy"] is None
    assert 0 <= analysis["quality_score"] <= 100
    assert analysis["columns_to_clean"] == ["holey"]


def test_clean_dataset_scores_100() -> None:
    df = pd.DataFrame({"a": [1.0, 2.0, 3.0, 4.0] * 10, "b": ["x", "y"] * 20})
    assert analyze_dataframe(df)["quality_score"] == 100


def test_algorithm_registry_validation() -> None:
    validated = algo.validate_hyperparameters("decision_tree", {"max_depth": 7})
    assert validated["max_depth"] == 7
    assert validated["criterion"] == "gini"
    with pytest.raises(InvalidInputError):
        algo.validate_hyperparameters("xgboost", {})  # hors registre ([NE PAS REPRODUIRE] T8)
    with pytest.raises(InvalidInputError):
        algo.validate_hyperparameters("decision_tree", {"max_depth": 999})
    with pytest.raises(InvalidInputError):
        algo.validate_hyperparameters("random_forest", {"n_estimators": 5, "extra": 1})


def test_schemas_expose_presets_and_defaults() -> None:
    cards = algo.hyperparameter_schemas()
    assert [c["key"] for c in cards] == ["decision_tree", "random_forest"]
    assert cards[1]["presets"]["balanced"]["n_estimators"] == 100
    assert cards[0]["defaults"]["max_depth"] == 5


def _trained(task_type: str = "classification"):  # type: ignore[no-untyped-def]
    rng = np.random.RandomState(42)
    n = 120
    df = pd.DataFrame(
        {
            "f1": rng.normal(0, 1, n),
            "f2": rng.normal(5, 2, n),
            "cat": rng.choice(["a", "b"], n),
        }
    )
    if task_type == "classification":
        df["target"] = np.where(df["f1"] + rng.normal(0, 0.3, n) > 0, "pos", "neg")
    else:
        df["target"] = df["f1"] * 3 + rng.normal(0, 0.2, n)
    config = PreprocessingConfig.model_validate({"target_column": "target", "task_type": task_type})
    prepared = preprocess(df, config)
    estimator = algo.build_estimator("random_forest", task_type, {"n_estimators": 30})
    estimator.fit(prepared.X_train, prepared.y_train)
    return estimator, prepared


def test_classification_metrics_and_viz() -> None:
    estimator, prepared = _trained("classification")
    metrics, viz = evaluation.evaluate_classification(
        estimator, prepared.X_test, prepared.y_test, prepared.class_names or []
    )
    for key in ("accuracy", "f1_macro", "precision_macro", "recall_macro", "roc_auc", "oob_score"):
        assert key in metrics, key
    assert metrics["primary_metric"] == "f1_macro"
    assert "per_class" in metrics and set(metrics["per_class"]) == set(prepared.class_names or [])
    assert viz["confusion_matrix"]["classes"] == prepared.class_names
    assert len(viz["roc_curve"]["points"]) > 2
    importance = evaluation.feature_importances(estimator, prepared.feature_names)
    assert importance and importance[0]["rank"] == 1
    tree = algo.extract_tree_structure(estimator, prepared.feature_names, prepared.class_names)
    assert tree is not None and tree["note"] == "1 arbre sur 30"
    assert tree["root"]["type"] in ("split", "leaf")


def test_regression_metrics_and_viz() -> None:
    estimator, prepared = _trained("regression")
    metrics, viz = evaluation.evaluate_regression(estimator, prepared.X_test, prepared.y_test)
    for key in ("mae", "mse", "rmse", "r2"):
        assert key in metrics
    assert metrics["primary_metric"] == "mae"
    assert len(viz["predicted_vs_actual"]) > 5
    assert len(viz["residuals_histogram"]) == 20


def test_composite_score_labels() -> None:
    assert evaluation.composite_score({"f1_macro": 0.95}, "classification")["label"] == "excellent"
    assert evaluation.composite_score({"f1_macro": 0.80}, "classification")["label"] == "good"
    assert evaluation.composite_score({"f1_macro": 0.65}, "classification")["label"] == "fair"
    assert (
        evaluation.composite_score({"f1_macro": 0.10}, "classification")["label"]
        == "needs_improvement"
    )
    assert evaluation.composite_score({"r2": -0.5}, "regression")["value"] == 0.0


def test_training_determinism_end_to_end() -> None:
    """P4 : deux entraînements identiques → métriques STRICTEMENT identiques."""
    est1, prep1 = _trained("classification")
    est2, prep2 = _trained("classification")
    m1, _ = evaluation.evaluate_classification(
        est1, prep1.X_test, prep1.y_test, prep1.class_names or []
    )
    m2, _ = evaluation.evaluate_classification(
        est2, prep2.X_test, prep2.y_test, prep2.class_names or []
    )
    assert m1 == m2
    i1 = evaluation.feature_importances(est1, prep1.feature_names)
    i2 = evaluation.feature_importances(est2, prep2.feature_names)
    assert i1 == i2
