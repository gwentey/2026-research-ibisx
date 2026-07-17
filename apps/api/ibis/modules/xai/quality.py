"""KPI de qualité d'explication (CDC §9.3, ARCH §9.2) — fonctions PURES, testées.

[NE PAS REPRODUIRE] la v1 n'en calculait AUCUN. Ici chaque KPI est réellement
calculé ; s'il n'est pas calculable, il est ABSENT (P1) — jamais de valeur par défaut.
"""

from typing import Any

import numpy as np
from scipy.stats import spearmanr

COMPLETENESS_TOLERANCE = 0.01  # axiome d'efficience : écart relatif < 1 %
PARSIMONY_THRESHOLD = 0.8


def shap_completeness(
    shap_values: list[float], base_value: float, prediction: float
) -> dict[str, Any]:
    """|Σφᵢ + E[f(X)] − f(x)| / max(|f(x)|, ε) < 1 % (ADR-006)."""
    total = float(np.sum(shap_values)) + base_value
    error = abs(total - prediction) / max(abs(prediction), 1e-9)
    return {"error": round(error, 6), "satisfied": bool(error < COMPLETENESS_TOLERANCE)}


def rank_stability(rankings: list[list[str]]) -> dict[str, Any] | None:
    """Spearman moyen des classements top-10 sur 5 ré-échantillonnages (seeds 42–46)."""
    if len(rankings) < 2:
        return None
    correlations: list[float] = []
    for i in range(len(rankings)):
        for j in range(i + 1, len(rankings)):
            common = [f for f in rankings[i] if f in rankings[j]]
            if len(common) < 3:
                continue
            ranks_i = [rankings[i].index(f) for f in common]
            ranks_j = [rankings[j].index(f) for f in common]
            rho, _ = spearmanr(ranks_i, ranks_j)
            if not np.isnan(rho):
                correlations.append(float(rho))
    if not correlations:
        return None
    mean_rho = float(np.mean(correlations))
    label = "very_stable" if mean_rho >= 0.9 else "stable" if mean_rho >= 0.7 else "unstable"
    return {"spearman_mean": round(mean_rho, 4), "label": label, "resamples": len(rankings)}


def inter_method_agreement(
    shap_ranking: list[str], lime_ranking: list[str], top: int = 10
) -> dict[str, Any] | None:
    """Corrélation de Spearman entre classements SHAP et LIME (top 10) [SHOULD]."""
    shap_top = shap_ranking[:top]
    lime_top = lime_ranking[:top]
    common = [f for f in shap_top if f in lime_top]
    if len(common) < 3:
        return None
    rho, _ = spearmanr([shap_top.index(f) for f in common], [lime_top.index(f) for f in common])
    if np.isnan(rho):
        return None
    return {"spearman": round(float(rho), 4), "common_features": len(common)}


def parsimony(importances: list[float]) -> dict[str, Any] | None:
    """Plus petit k tel que la somme des importances triées ≥ 80 % du total."""
    magnitudes = sorted((abs(v) for v in importances), reverse=True)
    total = sum(magnitudes)
    if total <= 0:
        return None
    cumulative = 0.0
    for k, value in enumerate(magnitudes, start=1):
        cumulative += value
        if cumulative / total >= PARSIMONY_THRESHOLD:
            return {"k": k, "total_features": len(magnitudes), "threshold": PARSIMONY_THRESHOLD}
    return {
        "k": len(magnitudes),
        "total_features": len(magnitudes),
        "threshold": PARSIMONY_THRESHOLD,
    }


def lime_fidelity(score: float | None) -> dict[str, Any] | None:
    """R² du modèle linéaire local LIME — stocké ET exposé ([NE PAS REPRODUIRE] : jeté en v1)."""
    if score is None or np.isnan(score):
        return None
    label = "high" if score >= 0.8 else "medium" if score >= 0.5 else "low"
    return {"r2": round(float(score), 4), "label": label}
