"""Moteur XAI (CDC §9.2) : SHAP TreeExplainer / LIME Tabular, seedés, honnêtes.

- Reconstruction DÉTERMINISTE des données (P4 : même preprocess, même split 42).
- Sélection de méthode justifiée : arbre → SHAP Tree (exact, rapide) ; sinon LIME.
- Multiclasse global : moyenne des |SHAP| sur les classes (politique `mean_abs`,
  TRACÉE dans les métadonnées).
- L'importance native reste étiquetée « feature_importance », jamais « SHAP » (P2).
"""

import io
import time
from dataclasses import dataclass
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from ibis.core.errors import NotFoundError
from ibis.modules.datasets.profiling import sanitize_json
from ibis.modules.datasets.service import get_dataset, load_file_dataframe
from ibis.modules.experiments.models import Experiment
from ibis.modules.ml.preprocessing import PreprocessingConfig, PreprocessResult, preprocess
from ibis.modules.xai import quality
from ibis.storage import get_storage

RANDOM_STATE = 42
GLOBAL_SAMPLE = 100
LIME_GLOBAL_LOCALS = 50
LIME_NUM_FEATURES = 10
LIME_NUM_SAMPLES = 1000  # réellement transmis ([NE PAS REPRODUIRE] v1)
STABILITY_SEEDS = (42, 43, 44, 45, 46)
TOP_DISPLAY = 15


@dataclass
class LoadedExperiment:
    experiment: Experiment
    model: Any
    prepared: PreprocessResult
    config: PreprocessingConfig
    feature_names: list[str]
    class_names: list[str] | None
    # DataFrame source rechargé (colonnes BRUTES) — pour l'analyse d'équité par attribut sensible.
    raw_df: Any = None


def load_experiment_context(db: Session, experiment: Experiment) -> LoadedExperiment:
    """Recharge modèle + données préparées — reproductible à l'identique (P4)."""
    storage = get_storage()
    if not experiment.artifact_key or not storage.exists(experiment.artifact_key):
        raise NotFoundError("Artefact du modèle indisponible", code="MODEL_UNAVAILABLE")
    with storage.open(experiment.artifact_key) as fh:
        artifact = joblib.load(io.BytesIO(fh.read()))

    dataset = get_dataset(db, experiment.dataset_id)
    if not dataset.files:
        raise NotFoundError("Dataset indisponible", code="DATASET_UNAVAILABLE")
    df = load_file_dataframe(dataset.files[0])
    config = PreprocessingConfig.model_validate(experiment.preprocessing_config)
    prepared = preprocess(df, config)  # même split, mêmes features (random_state=42)

    return LoadedExperiment(
        experiment=experiment,
        model=artifact["model"],
        prepared=prepared,
        config=config,
        feature_names=artifact["feature_names"],
        class_names=artifact.get("class_names"),
        raw_df=df,
    )


def choose_method(model: Any, requested: str) -> tuple[str, str]:
    """Méthode + justification affichée (CDC §9.2)."""
    is_tree = hasattr(model, "tree_") or hasattr(model, "estimators_")
    if requested in ("shap", "auto") and is_tree:
        return (
            "shap_tree",
            "SHAP TreeExplainer : exact pour les modèles à base d'arbres, 30–300× plus rapide "
            "que l'approche générique.",
        )
    if requested == "shap" and not is_tree:
        return ("lime", "Modèle non arborescent : repli LIME (approximation linéaire locale).")
    if requested == "lime":
        return ("lime", "LIME demandé explicitement : approximation linéaire locale seedée.")
    return (
        "lime" if not is_tree else "shap_tree",
        "Sélection automatique selon la famille du modèle.",
    )


def _predict_value(model: Any, X: pd.DataFrame, index: int, class_names: list[str] | None) -> float:
    if class_names is not None and hasattr(model, "predict_proba"):
        proba = model.predict_proba(X.iloc[[index]])[0]
        return float(proba[int(np.argmax(proba))])
    return float(model.predict(X.iloc[[index]])[0])


def _shap_matrix(
    model: Any, X: pd.DataFrame, class_names: list[str] | None
) -> tuple[np.ndarray, float]:
    """|SHAP| moyen multiclasse (mean_abs) ou valeurs binaires/régression + base value."""
    import shap

    explainer = shap.TreeExplainer(model)
    raw = explainer.shap_values(X)
    base = explainer.expected_value
    if isinstance(raw, list):  # multiclasse : liste par classe
        stacked = np.stack([np.abs(v) for v in raw])
        values = stacked.mean(axis=0)
        base_value = float(np.mean(base)) if np.ndim(base) else float(base)
    elif raw.ndim == 3:  # (n, features, classes)
        values = np.abs(raw).mean(axis=2)
        base_value = float(np.mean(base)) if np.ndim(base) else float(base)
    else:
        values = raw
        base_value = float(base[0]) if np.ndim(base) else float(base)
    return values, base_value


def _sample(X: pd.DataFrame, n: int, seed: int) -> pd.DataFrame:
    if len(X) <= n:
        return X
    return X.sample(n=n, random_state=seed)


def run_shap_global(loaded: LoadedExperiment) -> dict[str, Any]:
    started = time.perf_counter()
    X = _sample(loaded.prepared.X_train, GLOBAL_SAMPLE, RANDOM_STATE)
    values, _base_value = _shap_matrix(loaded.model, X, loaded.class_names)
    mean_abs = np.abs(values).mean(axis=0)
    ranking = [loaded.feature_names[i] for i in np.argsort(-mean_abs)]
    importance = [
        {"feature": f, "value": round(float(mean_abs[loaded.feature_names.index(f)]), 6)}
        for f in ranking[:TOP_DISPLAY]
    ]

    # Stabilité : 5 recalculs sur 5 sous-échantillons (seeds 42–46)
    rankings: list[list[str]] = []
    for seed in STABILITY_SEEDS:
        Xs = _sample(loaded.prepared.X_train, GLOBAL_SAMPLE, seed)
        vs, _ = _shap_matrix(loaded.model, Xs, loaded.class_names)
        ma = np.abs(vs).mean(axis=0)
        rankings.append([loaded.feature_names[i] for i in np.argsort(-ma)][:10])
    stability = quality.rank_stability(rankings)

    # Beeswarm simplifié [SHOULD] : top 8 features, points (valeur SHAP, valeur feature)
    top8 = ranking[:8]
    signed = values
    beeswarm = []
    for feature in top8:
        idx = loaded.feature_names.index(feature)
        feature_values = X.iloc[:, idx].astype(float)
        normalized = (
            (feature_values - feature_values.min())
            / max(1e-9, float(feature_values.max() - feature_values.min()))
        ).round(3)
        beeswarm.append(
            {
                "feature": feature,
                "points": [
                    {"shap": round(float(signed[i][idx]), 5), "fv": float(normalized.iloc[i])}
                    for i in range(len(X))
                ],
            }
        )

    kpis: dict[str, Any] = {"computation_seconds": round(time.perf_counter() - started, 2)}
    if stability:
        kpis["stability"] = stability
    pars = quality.parsimony([float(v) for v in mean_abs])
    if pars:
        kpis["parsimony"] = pars

    return sanitize_json(
        {
            "method_used": "shap_tree",
            "values": {
                "importance": importance,
                "ranking": ranking[:TOP_DISPLAY],
                "metadata": {
                    "random_state": RANDOM_STATE,
                    "sample_size": len(X),
                    "multiclass_policy": "mean_abs" if loaded.class_names else None,
                    "stability_seeds": list(STABILITY_SEEDS),
                },
            },
            "viz": {"global_importance": importance, "beeswarm": beeswarm},
            "kpis": kpis,
        }
    )


def run_shap_local(loaded: LoadedExperiment, instance_index: int) -> dict[str, Any]:
    import shap

    started = time.perf_counter()
    X_test = loaded.prepared.X_test.reset_index(drop=True)
    if not 0 <= instance_index < len(X_test):
        raise NotFoundError("Instance de test introuvable", code="INSTANCE_NOT_FOUND")
    x = X_test.iloc[[instance_index]]

    explainer = shap.TreeExplainer(loaded.model)
    raw = explainer.shap_values(x)
    base = explainer.expected_value
    if loaded.class_names is not None and hasattr(loaded.model, "predict_proba"):
        proba = loaded.model.predict_proba(x)[0]
        predicted_class = int(np.argmax(proba))
        if isinstance(raw, list):
            contributions = np.asarray(raw[predicted_class][0], dtype=float)
            base_value = float(base[predicted_class]) if np.ndim(base) else float(base)
        elif np.ndim(raw) == 3:
            contributions = np.asarray(raw[0, :, predicted_class], dtype=float)
            base_value = float(base[predicted_class]) if np.ndim(base) else float(base)
        else:
            contributions = np.asarray(raw[0], dtype=float)
            base_value = float(base) if np.ndim(base) == 0 else float(base[0])
        prediction = float(proba[predicted_class])
        predicted_label = loaded.class_names[predicted_class]
    else:
        contributions = np.asarray(raw[0], dtype=float).ravel()
        base_value = float(base) if np.ndim(base) == 0 else float(base[0])
        prediction = float(loaded.model.predict(x)[0])
        predicted_label = None

    order = np.argsort(-np.abs(contributions))[:10]
    waterfall = [
        {
            "feature": loaded.feature_names[i],
            "contribution": round(float(contributions[i]), 5),
            "instance_value": round(float(x.iloc[0, i]), 4),
        }
        for i in order
    ]
    completeness = quality.shap_completeness(
        [float(c) for c in contributions], base_value, prediction
    )
    kpis: dict[str, Any] = {
        "computation_seconds": round(time.perf_counter() - started, 2),
        "shap_completeness": completeness,
    }
    pars = quality.parsimony([float(c) for c in contributions])
    if pars:
        kpis["parsimony"] = pars

    return sanitize_json(
        {
            "method_used": "shap_tree",
            "values": {
                "contributions": waterfall,
                "base_value": round(base_value, 5),
                "prediction": round(prediction, 5),
                "predicted_label": predicted_label,
                "metadata": {"random_state": RANDOM_STATE, "instance_index": instance_index},
            },
            "viz": {"waterfall": waterfall, "base_value": round(base_value, 5)},
            "kpis": kpis,
        }
    )


def _lime_explainer(loaded: LoadedExperiment):  # type: ignore[no-untyped-def]
    from lime.lime_tabular import LimeTabularExplainer

    return LimeTabularExplainer(
        loaded.prepared.X_train.to_numpy(),
        feature_names=loaded.feature_names,
        class_names=loaded.class_names,
        discretize_continuous=True,
        random_state=RANDOM_STATE,
        mode="classification" if loaded.class_names else "regression",
    )


def _lime_predict_fn(loaded: LoadedExperiment):  # type: ignore[no-untyped-def]
    if loaded.class_names is not None:
        return loaded.model.predict_proba
    return loaded.model.predict


def run_lime_local(loaded: LoadedExperiment, instance_index: int) -> dict[str, Any]:
    started = time.perf_counter()
    X_test = loaded.prepared.X_test.reset_index(drop=True)
    if not 0 <= instance_index < len(X_test):
        raise NotFoundError("Instance de test introuvable", code="INSTANCE_NOT_FOUND")
    explainer = _lime_explainer(loaded)
    explanation = explainer.explain_instance(
        X_test.iloc[instance_index].to_numpy(),
        _lime_predict_fn(loaded),
        num_features=LIME_NUM_FEATURES,
        num_samples=LIME_NUM_SAMPLES,
    )
    weights = explanation.as_list()
    waterfall = [
        {"feature": name, "contribution": round(float(weight), 5), "instance_value": None}
        for name, weight in weights
    ]
    fidelity = quality.lime_fidelity(getattr(explanation, "score", None))
    kpis: dict[str, Any] = {"computation_seconds": round(time.perf_counter() - started, 2)}
    if fidelity:
        kpis["lime_fidelity"] = fidelity
    pars = quality.parsimony([float(w) for _, w in weights])
    if pars:
        kpis["parsimony"] = pars

    return sanitize_json(
        {
            "method_used": "lime",
            "values": {
                "contributions": waterfall,
                "metadata": {
                    "random_state": RANDOM_STATE,
                    "num_features": LIME_NUM_FEATURES,
                    "num_samples": LIME_NUM_SAMPLES,
                    "instance_index": instance_index,
                },
            },
            "viz": {"waterfall": waterfall},
            "kpis": kpis,
        }
    )


def run_lime_global(loaded: LoadedExperiment) -> dict[str, Any]:
    """LIME globale = agrégation de 50 explications locales (étiquetée comme telle)."""
    started = time.perf_counter()
    X_test = loaded.prepared.X_test.reset_index(drop=True)
    explainer = _lime_explainer(loaded)
    predict_fn = _lime_predict_fn(loaded)
    count = min(LIME_GLOBAL_LOCALS, len(X_test))
    indices = np.random.RandomState(RANDOM_STATE).choice(len(X_test), size=count, replace=False)

    aggregated: dict[str, list[float]] = {}
    fidelity_scores: list[float] = []
    for index in indices:
        explanation = explainer.explain_instance(
            X_test.iloc[int(index)].to_numpy(),
            predict_fn,
            num_features=LIME_NUM_FEATURES,
            num_samples=LIME_NUM_SAMPLES,
        )
        score = getattr(explanation, "score", None)
        if score is not None and not np.isnan(score):
            fidelity_scores.append(float(score))
        for name, weight in explanation.as_list():
            aggregated.setdefault(name, []).append(abs(float(weight)))

    means = sorted(
        ((name, float(np.mean(values))) for name, values in aggregated.items()),
        key=lambda item: -item[1],
    )
    importance = [
        {"feature": name, "value": round(value, 6)} for name, value in means[:TOP_DISPLAY]
    ]
    kpis: dict[str, Any] = {"computation_seconds": round(time.perf_counter() - started, 2)}
    fidelity = quality.lime_fidelity(float(np.mean(fidelity_scores)) if fidelity_scores else None)
    if fidelity:
        kpis["lime_fidelity"] = fidelity
    pars = quality.parsimony([value for _, value in means])
    if pars:
        kpis["parsimony"] = pars

    return sanitize_json(
        {
            "method_used": "lime",
            "values": {
                "importance": importance,
                "ranking": [name for name, _ in means[:TOP_DISPLAY]],
                "metadata": {
                    "random_state": RANDOM_STATE,
                    "aggregated_locals": count,
                    "note": "aggregation_of_local_explanations",
                },
            },
            "viz": {"global_importance": importance},
            "kpis": kpis,
        }
    )


def test_instances(
    loaded: LoadedExperiment, *, page: int, page_size: int, sort_by_error: bool
) -> dict[str, Any]:
    """Tableau serveur des instances de test (préd/réel, tri par erreur) — CDC §9.2."""
    X_test = loaded.prepared.X_test.reset_index(drop=True)
    y_test = np.asarray(loaded.prepared.y_test)
    predictions = loaded.model.predict(X_test)

    actual: list[str | float]
    predicted: list[str | float]
    if loaded.class_names is not None:
        actual = [loaded.class_names[int(v)] for v in y_test]
        predicted = [loaded.class_names[int(v)] for v in predictions]
        errors = [0.0 if a == p else 1.0 for a, p in zip(actual, predicted, strict=True)]
    else:
        actual = [round(float(v), 4) for v in y_test]
        predicted = [round(float(v), 4) for v in predictions]
        errors = [abs(float(a) - float(p)) for a, p in zip(actual, predicted, strict=True)]

    rows = [
        {
            "index": i,
            "actual": actual[i],
            "predicted": predicted[i],
            "error": round(float(errors[i]), 4),
            "features": {
                name: round(float(X_test.iloc[i][name]), 4) for name in loaded.feature_names[:8]
            },
        }
        for i in range(len(X_test))
    ]
    if sort_by_error:
        rows.sort(key=lambda r: (-float(r["error"]), int(r["index"])))  # type: ignore[arg-type]
    total = len(rows)
    start = (page - 1) * page_size
    return sanitize_json(
        {
            "total": total,
            "page": page,
            "page_size": page_size,
            "items": rows[start : start + page_size],
        }
    )
