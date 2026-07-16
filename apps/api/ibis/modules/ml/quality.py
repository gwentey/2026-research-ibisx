"""Analyse de qualité des données (CDC §8.2 É3) — cache 7 j, recommandations par colonne.

Partagée par l'étape 3 du wizard et le worker (P3). Le score et les
recommandations suivent EXACTEMENT la matrice du CDC.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats
from sqlalchemy import select
from sqlalchemy.orm import Session

from ibis.modules.datasets.models import QualityAnalysis
from ibis.modules.datasets.profiling import sanitize_json
from ibis.modules.datasets.service import get_dataset, load_file_dataframe

CACHE_DAYS = 7
Z_SCORE_THRESHOLD = 3.0
CATEGORICAL_MAX_UNIQUE = 50


def distribution_type(series: pd.Series) -> str:
    """normal / symmetric / right_skewed / left_skewed (normaltest + skewness)."""
    values = series.dropna().astype(float)
    if len(values) < 8 or values.nunique() < 3:
        return "unknown"
    skewness = float(stats.skew(values))
    try:
        _, p_value = stats.normaltest(values)
        if p_value > 0.05:
            return "normal"
    except Exception:
        pass
    if abs(skewness) < 0.5:
        return "symmetric"
    return "right_skewed" if skewness > 0 else "left_skewed"


def outliers_iqr_zscore(series: pd.Series) -> dict[str, Any]:
    values = series.dropna().astype(float)
    if len(values) < 4:
        return {"count": 0, "percentage": 0.0}
    q1, q3 = values.quantile(0.25), values.quantile(0.75)
    iqr = q3 - q1
    low, high = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    iqr_mask = (values < low) | (values > high)
    std = values.std()
    z_mask = (
        (np.abs((values - values.mean()) / std) > Z_SCORE_THRESHOLD)
        if std > 0
        else pd.Series(False, index=values.index)
    )
    count = int((iqr_mask | z_mask).sum())
    return {
        "count": count,
        "percentage": round(count / len(values) * 100, 2),
        "iqr_low": float(low),
        "iqr_high": float(high),
    }


def recommend_strategy(missing_pct: float, is_numeric: bool, distribution: str) -> str:
    """Matrice de recommandation du CDC §8.2 É3 — vocabulaire canonique uniquement."""
    if missing_pct > 70:
        return "drop_column"
    if missing_pct >= 40:
        return "knn" if is_numeric else "most_frequent"
    if missing_pct >= 15:
        if is_numeric:
            return "mean" if distribution == "normal" else "median"
        return "most_frequent"
    if is_numeric:
        return "mean" if distribution == "normal" else "median"
    return "most_frequent"


def analyze_dataframe(df: pd.DataFrame) -> dict[str, Any]:
    columns: list[dict[str, Any]] = []
    total_missing_penalty = 0.0
    outlier_penalty = 0.0
    row_count = len(df)

    for name in df.columns:
        series = df[name]
        missing_count = int(series.isna().sum())
        missing_pct = round(missing_count / max(1, row_count) * 100, 2)
        is_numeric = bool(pd.api.types.is_numeric_dtype(series)) and not pd.api.types.is_bool_dtype(
            series
        )
        dist = distribution_type(series) if is_numeric else "categorical"
        outliers = outliers_iqr_zscore(series) if is_numeric else {"count": 0, "percentage": 0.0}
        unique_count = int(series.dropna().nunique())

        columns.append(
            {
                "name": str(name),
                "dtype": str(series.dtype),
                "is_numeric": is_numeric,
                "is_categorical": (not is_numeric) or unique_count <= CATEGORICAL_MAX_UNIQUE,
                "missing_count": missing_count,
                "missing_percentage": missing_pct,
                "unique_count": unique_count,
                "distribution": dist,
                "outliers": outliers,
                "recommended_strategy": recommend_strategy(missing_pct, is_numeric, dist)
                if missing_count > 0
                else None,
            }
        )
        if outliers.get("percentage", 0) > 10:
            outlier_penalty = min(outlier_penalty + 20, 20 * len(df.columns))

    global_missing = float(df.isna().sum().sum()) / max(1, row_count * max(1, df.shape[1])) * 100
    total_missing_penalty = min(50.0, global_missing * 2)
    outlier_penalty = min(outlier_penalty, 20.0 * sum(1 for c in columns if c["is_numeric"]))
    # Score qualité global 0–100 (CDC) : 100 − pénalité manquants (max 50) − outliers (max 20/col)
    quality_score = round(max(0.0, 100.0 - total_missing_penalty - min(outlier_penalty, 40)))

    return sanitize_json(
        {
            "row_count": row_count,
            "column_count": df.shape[1],
            "global_missing_percentage": round(global_missing, 2),
            "quality_score": quality_score,
            "columns": columns,
            "columns_to_clean": [c["name"] for c in columns if c["missing_count"] > 0],
        }
    )


def get_or_compute_quality(
    db: Session, dataset_id: uuid.UUID, *, force: bool = False
) -> QualityAnalysis:
    """Cache 7 jours (table quality_analyses), invalidable par force=True."""
    now = datetime.now(UTC).replace(tzinfo=None)
    existing = db.scalar(select(QualityAnalysis).where(QualityAnalysis.dataset_id == dataset_id))
    if (
        existing is not None
        and not force
        and existing.expires_at is not None
        and existing.expires_at > now
    ):
        return existing

    dataset = get_dataset(db, dataset_id)
    if not dataset.files:
        from ibis.core.errors import NotFoundError

        raise NotFoundError("Ce dataset n'a aucun fichier de données", code="DATASET_NO_FILE")
    df = load_file_dataframe(dataset.files[0])
    analysis = analyze_dataframe(df)

    recommendations = {
        c["name"]: c["recommended_strategy"]
        for c in analysis["columns"]
        if c.get("recommended_strategy")
    }
    if existing is None:
        existing = QualityAnalysis(dataset_id=dataset_id)
        db.add(existing)
    existing.analysis = analysis
    existing.quality_score = analysis["quality_score"]
    existing.column_recommendations = recommendations
    existing.computed_at = now
    existing.expires_at = now + timedelta(days=CACHE_DAYS)
    db.commit()
    db.refresh(existing)
    return existing
