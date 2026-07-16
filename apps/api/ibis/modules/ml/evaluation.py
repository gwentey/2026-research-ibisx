"""Évaluation & données de visualisation JSON (CDC §8.2 É9) — jamais d'images.

[NE PAS REPRODUIRE] les PNG matplotlib base64 en BDD : viz_data est du JSON
rendu par Recharts côté client.
"""

from typing import Any

import numpy as np
from sklearn import metrics as sk

from ibis.modules.datasets.profiling import sanitize_json

VIZ_MAX_POINTS = 200
TOP_FEATURES = 20


def _roc_curve_points(y_true: Any, y_score: Any) -> dict[str, Any]:
    fpr, tpr, _ = sk.roc_curve(y_true, y_score)
    if len(fpr) > VIZ_MAX_POINTS:
        idx = np.linspace(0, len(fpr) - 1, VIZ_MAX_POINTS).astype(int)
        fpr, tpr = fpr[idx], tpr[idx]
    optimal = int(np.argmax(tpr - fpr))
    return {
        "points": [
            {"fpr": round(float(f), 4), "tpr": round(float(t), 4)}
            for f, t in zip(fpr, tpr, strict=True)
        ],
        "auc": round(float(sk.auc(fpr, tpr)), 4),
        "optimal_index": min(optimal, len(fpr) - 1),
    }


def evaluate_classification(
    model: Any, X_test: Any, y_test: Any, class_names: list[str]
) -> tuple[dict[str, Any], dict[str, Any]]:
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test) if hasattr(model, "predict_proba") else None
    binary = len(class_names) == 2

    m: dict[str, Any] = {
        "accuracy": round(float(sk.accuracy_score(y_test, y_pred)), 4),
        "precision": round(
            float(sk.precision_score(y_test, y_pred, average="weighted", zero_division=0)), 4
        ),
        "recall": round(
            float(sk.recall_score(y_test, y_pred, average="weighted", zero_division=0)), 4
        ),
        "f1_score": round(
            float(sk.f1_score(y_test, y_pred, average="weighted", zero_division=0)), 4
        ),
        "precision_macro": round(
            float(sk.precision_score(y_test, y_pred, average="macro", zero_division=0)), 4
        ),
        "recall_macro": round(
            float(sk.recall_score(y_test, y_pred, average="macro", zero_division=0)), 4
        ),
        "f1_macro": round(float(sk.f1_score(y_test, y_pred, average="macro", zero_division=0)), 4),
        "primary_metric": "f1_macro",
    }
    if y_proba is not None:
        try:
            if binary:
                m["roc_auc"] = round(float(sk.roc_auc_score(y_test, y_proba[:, 1])), 4)
                m["pr_auc"] = round(float(sk.average_precision_score(y_test, y_proba[:, 1])), 4)
            else:
                m["roc_auc"] = round(
                    float(sk.roc_auc_score(y_test, y_proba, multi_class="ovr", average="macro")), 4
                )
        except ValueError:
            pass  # classe absente du test — AUC non calculable : ABSENTE (P1)
    if hasattr(model, "oob_score_"):
        m["oob_score"] = round(float(model.oob_score_), 4)

    report = sk.classification_report(
        y_test, y_pred, target_names=class_names, output_dict=True, zero_division=0
    )
    m["per_class"] = {
        name: {k: round(float(v), 4) for k, v in values.items()}
        for name, values in report.items()
        if isinstance(values, dict) and name in class_names
    }

    confusion = sk.confusion_matrix(y_test, y_pred)
    viz: dict[str, Any] = {
        "confusion_matrix": {"classes": class_names, "matrix": confusion.tolist()},
    }
    if y_proba is not None and binary:
        viz["roc_curve"] = _roc_curve_points(y_test, y_proba[:, 1])
        precision, recall, _ = sk.precision_recall_curve(y_test, y_proba[:, 1])
        if len(precision) > VIZ_MAX_POINTS:
            idx = np.linspace(0, len(precision) - 1, VIZ_MAX_POINTS).astype(int)
            precision, recall = precision[idx], recall[idx]
        viz["pr_curve"] = {
            "points": [
                {"precision": round(float(p), 4), "recall": round(float(r), 4)}
                for p, r in zip(precision, recall, strict=True)
            ]
        }
    return sanitize_json(m), sanitize_json(viz)


def evaluate_regression(
    model: Any, X_test: Any, y_test: Any
) -> tuple[dict[str, Any], dict[str, Any]]:
    y_pred = model.predict(X_test)
    m = {
        "mae": round(float(sk.mean_absolute_error(y_test, y_pred)), 4),
        "mse": round(float(sk.mean_squared_error(y_test, y_pred)), 4),
        "rmse": round(float(np.sqrt(sk.mean_squared_error(y_test, y_pred))), 4),
        "r2": round(float(sk.r2_score(y_test, y_pred)), 4),
        "primary_metric": "mae",
    }
    y_true = np.asarray(y_test, dtype=float)
    y_hat = np.asarray(y_pred, dtype=float)
    if len(y_true) > VIZ_MAX_POINTS:
        idx = np.linspace(0, len(y_true) - 1, VIZ_MAX_POINTS).astype(int)
        y_true_s, y_hat_s = y_true[idx], y_hat[idx]
    else:
        y_true_s, y_hat_s = y_true, y_hat
    residuals = y_true_s - y_hat_s
    hist, edges = np.histogram(y_true - y_hat, bins=20)
    viz = {
        "predicted_vs_actual": [
            {"actual": round(float(a), 4), "predicted": round(float(p), 4)}
            for a, p in zip(y_true_s, y_hat_s, strict=True)
        ],
        "residuals": [
            {"predicted": round(float(p), 4), "residual": round(float(r), 4)}
            for p, r in zip(y_hat_s, residuals, strict=True)
        ],
        "residuals_histogram": [
            {"bin": round(float((edges[i] + edges[i + 1]) / 2), 4), "count": int(hist[i])}
            for i in range(len(hist))
        ],
    }
    return sanitize_json(m), sanitize_json(viz)


def feature_importances(model: Any, feature_names: list[str]) -> list[dict[str, Any]]:
    """Importance NATIVE (Gini) top 20 — toujours étiquetée « importance du modèle » (P2)."""
    if not hasattr(model, "feature_importances_"):
        return []
    pairs = sorted(
        zip(feature_names, model.feature_importances_, strict=True),
        key=lambda item: -item[1],
    )[:TOP_FEATURES]
    return [
        {"feature": name, "importance": round(float(value), 4), "rank": rank}
        for rank, (name, value) in enumerate(pairs, start=1)
    ]


def composite_score(metrics: dict[str, Any], task_type: str) -> dict[str, Any]:
    """Score global composite + qualification (CDC §8.2 É9) — méthode affichée en tooltip."""
    if task_type == "classification":
        value = float(metrics.get("f1_macro", 0)) * 100
        method = "f1_macro × 100"
    else:
        value = max(0.0, float(metrics.get("r2", 0))) * 100
        method = "max(0, R²) × 100"
    if value >= 90:
        label = "excellent"
    elif value >= 75:
        label = "good"
    elif value >= 60:
        label = "fair"
    else:
        label = "needs_improvement"
    return {"value": round(value, 1), "label": label, "method": method}
