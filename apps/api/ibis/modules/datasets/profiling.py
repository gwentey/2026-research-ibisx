"""Profiling pandas d'un fichier de données (CDC §5.5) — types, PII, stats, agrégats.

Toutes les statistiques sont calculées sur le fichier COMPLET (pas d'échantillon),
assainies pour JSONB (jamais de NaN/Inf — ADR-002), et la détection PII est
RÉELLEMENT persistée ([NE PAS REPRODUIRE] le TODO permanent de la v1).
"""

import io
import math
import re
from dataclasses import dataclass, field
from typing import Any

import pandas as pd

from ibis.core.errors import InvalidInputError
from ibis.modules.ml.vocab import MISSING_VALUE_TOKENS

SUPPORTED_FORMATS = ("csv", "xlsx", "json", "parquet")
MAX_EXAMPLE_VALUES = 5
CATEGORICAL_MAX_UNIQUE = 50
CATEGORICAL_MAX_RATIO = 0.5

PII_NAME_KEYWORDS = (
    "email",
    "e-mail",
    "mail",
    "phone",
    "telephone",
    "tel",
    "mobile",
    "name",
    "nom",
    "prenom",
    "prénom",
    "firstname",
    "lastname",
    "surname",
    "address",
    "adresse",
    "street",
    "zipcode",
    "postal",
    "ssn",
    "social_security",
    "passport",
    "iban",
    "credit_card",
    "card_number",
    "ip_address",
    "birthdate",
    "date_of_birth",
    "dob",
)
EMAIL_RE = re.compile(r"^[\w.+-]+@[\w-]+\.[\w.-]{2,}$")
PHONE_RE = re.compile(r"^\+?[\d\s().-]{7,20}$")


def sanitize_json(value: Any) -> Any:
    """NaN/Inf → None, types numpy → natifs — sanitizer JSONB unique (ADR-002)."""
    if isinstance(value, dict):
        return {str(k): sanitize_json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [sanitize_json(v) for v in value]
    if isinstance(value, float):
        return None if (math.isnan(value) or math.isinf(value)) else value
    if hasattr(value, "item"):  # scalaires numpy
        return sanitize_json(value.item())
    return value


def read_dataframe(content: bytes, filename: str) -> pd.DataFrame:
    """Parse effectif du fichier (un fichier qui ne se parse pas est rejeté — ARCH §13)."""
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension == "xls":
        extension = "xlsx"
    if extension not in SUPPORTED_FORMATS:
        raise InvalidInputError(
            f"Format non supporté : .{extension} (attendu : {', '.join(SUPPORTED_FORMATS)})",
            code="UNSUPPORTED_FORMAT",
        )
    buffer = io.BytesIO(content)
    try:
        if extension == "csv":
            df = pd.read_csv(buffer, sep=None, engine="python", encoding_errors="replace")
        elif extension == "xlsx":
            df = pd.read_excel(buffer)
        elif extension == "json":
            df = pd.read_json(buffer)
        else:
            df = pd.read_parquet(buffer)
    except InvalidInputError:
        raise
    except Exception as exc:
        raise InvalidInputError(
            f"Fichier illisible ({filename}) : {exc}", code="UNPARSABLE_FILE"
        ) from exc
    if df.empty or df.shape[1] == 0:
        raise InvalidInputError(f"Fichier vide : {filename}", code="EMPTY_FILE")
    return normalize_dataframe(df)


def normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Normalisation des « faux manquants » — UN seul endroit (P3, vocab.py)."""
    df = df.copy()
    # Colonnes fantômes (index exportés, 100 % nulles)
    drop = [c for c in df.columns if str(c).startswith("Unnamed:") or df[c].isna().all()]
    df = df.drop(columns=drop)
    object_columns = df.select_dtypes(include=["object"]).columns
    for column in object_columns:
        stripped = df[column].map(lambda v: v.strip() if isinstance(v, str) else v)
        df[column] = stripped.map(
            lambda v: (
                None if isinstance(v, str) and v.strip().lower() in MISSING_VALUE_TOKENS else v
            )
        )
    return df


def interpret_dtype(series: pd.Series) -> str:
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    if pd.api.types.is_numeric_dtype(series):
        return "numerical"
    non_null = series.dropna()
    if non_null.empty:
        return "text"
    unique = non_null.nunique()
    if unique <= 2 and set(map(lambda v: str(v).strip().lower(), non_null.unique())) <= {
        "true",
        "false",
        "yes",
        "no",
        "0",
        "1",
        "oui",
        "non",
    }:
        return "boolean"
    if unique <= CATEGORICAL_MAX_UNIQUE and unique / len(non_null) <= CATEGORICAL_MAX_RATIO:
        return "categorical"
    return "text"


def detect_pii(name: str, series: pd.Series) -> bool:
    lowered = name.strip().lower().replace(" ", "_")
    if any(keyword in lowered for keyword in PII_NAME_KEYWORDS):
        return True
    sample = series.dropna().astype(str).head(50)
    if sample.empty:
        return False
    email_hits = sum(bool(EMAIL_RE.match(v)) for v in sample)
    return email_hits / len(sample) > 0.5


@dataclass
class ColumnProfile:
    name: str
    dtype_original: str
    dtype_interpreted: str
    is_nullable: bool
    is_pii: bool
    example_values: list[str]
    position: int
    stats: dict[str, Any]


@dataclass
class FileProfile:
    row_count: int
    column_count: int
    missing_percentage: float
    columns: list[ColumnProfile] = field(default_factory=list)


def profile_dataframe(df: pd.DataFrame) -> FileProfile:
    row_count = len(df)
    columns: list[ColumnProfile] = []
    total_cells = max(1, row_count * max(1, df.shape[1]))
    total_missing = int(df.isna().sum().sum())

    for position, name in enumerate(df.columns):
        series = df[name]
        null_count = int(series.isna().sum())
        non_null = series.dropna()
        stats: dict[str, Any] = {
            "null_count": null_count,
            "null_percentage": round(null_count / max(1, row_count) * 100, 2),
            "unique_count": int(non_null.nunique()),
            "row_count": row_count,
        }
        if pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_bool_dtype(series):
            described = series.describe()
            stats.update(
                {
                    "min": described.get("min"),
                    "max": described.get("max"),
                    "mean": described.get("mean"),
                    "std": described.get("std"),
                }
            )
        else:
            top = non_null.astype(str).value_counts().head(3)
            stats["top_values"] = [{"value": str(v)[:80], "count": int(c)} for v, c in top.items()]

        examples = [str(v)[:80] for v in non_null.head(MAX_EXAMPLE_VALUES).tolist()]
        columns.append(
            ColumnProfile(
                name=str(name)[:255],
                dtype_original=str(series.dtype),
                dtype_interpreted=interpret_dtype(series),
                is_nullable=null_count > 0,
                is_pii=detect_pii(str(name), series),
                example_values=examples,
                position=position,
                stats=sanitize_json(stats),
            )
        )

    return FileProfile(
        row_count=row_count,
        column_count=df.shape[1],
        missing_percentage=round(total_missing / total_cells * 100, 2),
        columns=columns,
    )


# --- Suggestions pour l'assistant d'upload (CDC §5.5.b) -------------------------------------

DOMAIN_KEYWORDS: dict[str, tuple[str, ...]] = {
    "education": ("student", "school", "grade", "exam", "course", "teacher", "etude", "eleve"),
    "healthcare": (
        "patient",
        "diagnosis",
        "disease",
        "blood",
        "medical",
        "health",
        "bmi",
        "insulin",
    ),
    "finance": ("price", "credit", "loan", "income", "salary", "bank", "amount", "balance"),
    "social": ("user", "tweet", "post", "follower", "comment", "social"),
    "biology": ("species", "sepal", "petal", "gene", "cell", "organism"),
    "environment": ("temperature", "climate", "pollution", "weather", "co2", "humidity"),
    "business": ("sales", "customer", "product", "order", "revenue", "marketing"),
    "technology": ("cpu", "device", "sensor", "log", "network", "software"),
}


def suggest_domains(column_names: list[str]) -> list[str]:
    lowered = " ".join(name.lower() for name in column_names)
    scores = {
        domain: sum(1 for kw in keywords if kw in lowered)
        for domain, keywords in DOMAIN_KEYWORDS.items()
    }
    ranked = [d for d, s in sorted(scores.items(), key=lambda kv: -kv[1]) if s > 0]
    return ranked[:3]


def suggest_tasks(profile: FileProfile) -> list[str]:
    """Tâches ML plausibles selon les types de colonnes (heuristique honnête)."""
    tasks: list[str] = []
    has_categorical = any(
        c.dtype_interpreted in ("categorical", "boolean") for c in profile.columns
    )
    has_numeric = any(c.dtype_interpreted == "numerical" for c in profile.columns)
    if has_categorical:
        tasks.append("classification")
    if has_numeric:
        tasks.append("regression")
    if any(c.dtype_interpreted == "datetime" for c in profile.columns):
        tasks.append("time_series")
    if any(c.dtype_interpreted == "text" for c in profile.columns):
        tasks.append("nlp")
    return tasks or ["classification"]


def indicative_quality_score(profile: FileProfile) -> int:
    """Score indicatif 0–100 pour l'assistant d'upload (pénalité manquants, CDC §8.2)."""
    penalty = min(50.0, profile.missing_percentage * 2)
    return round(100 - penalty)
