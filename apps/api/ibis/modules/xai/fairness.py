"""Comparateur d'équité par attribut sensible (post-hoc, reproductible — P4).

Additif : recharge modèle + split déterministe (via `load_experiment_context`), prédit sur
le jeu de test, regroupe les prédictions par la valeur BRUTE d'une colonne sensible, et
calcule des métriques d'équité par groupe. Ne touche NI le worker d'entraînement NI le
déterminisme (`random_state=42`). Cf. docs/cdc-profils-invites.md §7.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from ibis.core.errors import InvalidInputError
from ibis.modules.datasets.profiling import sanitize_json
from ibis.modules.xai.engine import LoadedExperiment

# Au-delà, un regroupement par valeur brute n'a plus de sens (colonne continue type âge).
MAX_GROUPS = 12


def compute_group_fairness(
    y_true: list[Any], y_pred: list[Any], groups: list[Any], favorable: Any | None = None
) -> dict[str, Any]:
    """Métriques d'équité par groupe. Fonction PURE (aucun I/O), testable isolément.

    - ``y_true`` / ``y_pred`` : étiquettes réelles / prédites (mêmes valeurs comparables) ;
    - ``groups`` : valeur de l'attribut sensible pour chaque ligne (aligné à ``y_*``) ;
    - ``favorable`` : étiquette « favorable » (issue positive) ; par défaut, en binaire,
      la dernière classe triée.

    En binaire : taux de sélection (parité démographique), taux de vrais positifs
    (égalité des chances), exactitude, et ratios de disparité (règle des 80 %).
    En multiclasse : exactitude par groupe uniquement (les autres métriques n'ont pas de
    définition univoque).
    """
    yt = [str(v) for v in y_true]
    yp = [str(v) for v in y_pred]
    grp = [str(g) for g in groups]
    if not (len(yt) == len(yp) == len(grp)):
        raise InvalidInputError(
            "Longueurs incohérentes pour l'analyse d'équité", code="FAIRNESS_LENGTH_MISMATCH"
        )
    n = len(yt)
    classes = sorted(set(yt) | set(yp))
    binary = len(classes) == 2
    fav = str(favorable) if favorable is not None else (classes[-1] if binary else None)

    per_group: list[dict[str, Any]] = []
    for value in sorted(set(grp)):
        idx = [i for i in range(n) if grp[i] == value]
        size = len(idx)
        accuracy = sum(1 for i in idx if yp[i] == yt[i]) / size if size else None
        entry: dict[str, Any] = {"value": value, "size": size, "accuracy": accuracy}
        if binary and fav is not None:
            selection_rate = sum(1 for i in idx if yp[i] == fav) / size if size else None
            positives = [i for i in idx if yt[i] == fav]
            tpr = sum(1 for i in positives if yp[i] == fav) / len(positives) if positives else None
            entry["selection_rate"] = selection_rate
            entry["tpr"] = tpr
        per_group.append(entry)

    accuracies = [e["accuracy"] for e in per_group if e["accuracy"] is not None]
    disparities: dict[str, Any] = {
        "accuracy_gap": (max(accuracies) - min(accuracies)) if accuracies else None
    }
    if binary and fav is not None:
        rates = [e["selection_rate"] for e in per_group if e.get("selection_rate") is not None]
        tprs = [e["tpr"] for e in per_group if e.get("tpr") is not None]
        ratio = min(rates) / max(rates) if rates and max(rates) > 0 else None
        disparities["selection_rate_ratio"] = ratio
        disparities["tpr_gap"] = (max(tprs) - min(tprs)) if tprs else None
        # Règle des 80 % (disparate impact) : un ratio < 0,8 signale une disparité.
        disparities["four_fifths_pass"] = ratio is None or ratio >= 0.8

    return {
        "binary": binary,
        "favorable": fav,
        "classes": classes,
        "total": n,
        "groups": per_group,
        "disparities": disparities,
    }


def fairness_report(
    loaded: LoadedExperiment, *, sensitive_column: str, favorable: str | None = None
) -> dict[str, Any]:
    """Rapport d'équité pour une expérience de CLASSIFICATION, par colonne sensible brute."""
    if loaded.class_names is None:
        return sanitize_json(
            {"applicable": False, "reason": "regression", "sensitive_column": sensitive_column}
        )

    df = loaded.raw_df
    if df is None or sensitive_column not in df.columns:
        raise InvalidInputError(
            f"Colonne sensible introuvable : {sensitive_column}", code="FAIRNESS_COLUMN_UNKNOWN"
        )

    test_index = loaded.prepared.test_index
    groups = df.loc[test_index, sensitive_column].tolist()

    n_groups = len({str(g) for g in groups})
    if n_groups > MAX_GROUPS:
        raise InvalidInputError(
            f"Colonne « {sensitive_column} » trop granulaire ({n_groups} valeurs) pour une "
            f"analyse par groupe (max {MAX_GROUPS}).",
            code="FAIRNESS_TOO_MANY_GROUPS",
        )

    x_test = loaded.prepared.X_test.reset_index(drop=True)
    y_test = np.asarray(loaded.prepared.y_test)
    predictions = loaded.model.predict(x_test)
    class_names = loaded.class_names
    y_true = [class_names[int(v)] for v in y_test]
    y_pred = [class_names[int(v)] for v in predictions]

    report = compute_group_fairness(y_true, y_pred, groups, favorable=favorable)
    report["applicable"] = True
    report["sensitive_column"] = sensitive_column
    return sanitize_json(report)
