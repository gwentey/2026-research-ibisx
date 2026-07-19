"""Preprocessing RÉELLEMENT appliqué (CDC §8.3) — le contrat d'honnêteté du produit.

[NE PAS REPRODUIRE] T1 (config ignorée), T2 (stratégies qui crashent),
T3 (scaling toujours appliqué), alias silencieux. Ici : vocabulaire fermé
(ml/vocab.py), séquence exacte du CDC, fit sur train UNIQUEMENT, et le détail
des transformations appliquées est retourné et persisté (`applied: true`).
"""

import re
from dataclasses import dataclass, field
from typing import Any, Literal

import pandas as pd
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sklearn.compose import ColumnTransformer
from sklearn.experimental import enable_iterative_imputer  # noqa: F401 — active IterativeImputer
from sklearn.impute import IterativeImputer, KNNImputer, SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import (
    LabelEncoder,
    MinMaxScaler,
    OneHotEncoder,
    OrdinalEncoder,
    RobustScaler,
    StandardScaler,
)

from ibis.core.errors import InvalidInputError
from ibis.modules.ml.vocab import CANONICAL_STRATEGIES, MISSING_VALUE_TOKENS

RANDOM_STATE = 42  # P4 — affiché, non modifiable en mode guidé
ID_COLUMN_PATTERN = re.compile(r"^(id|index|idx|row_id|item_id|.*_id)$", re.IGNORECASE)


class ColumnStrategy(BaseModel):
    model_config = ConfigDict(extra="forbid")

    strategy: Literal[
        "mean",
        "median",
        "most_frequent",
        "constant",
        "knn",
        "iterative",
        "drop_rows",
        "drop_column",
    ]
    constant_value: str | float | None = None


class ScalingConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool = True
    method: Literal["standard", "minmax", "robust"] = "standard"


class PreprocessingConfig(BaseModel):
    """Contrat v2 strict (`extra=forbid`) — validé à la création de l'expérience."""

    model_config = ConfigDict(extra="forbid")

    target_column: str
    task_type: Literal["classification", "regression"]
    test_size: float = Field(default=0.2, ge=0.1, le=0.5)
    random_state: Literal[42] = 42  # P4 : verrouillé
    column_strategies: dict[str, ColumnStrategy] = Field(default_factory=dict)
    default_numeric_strategy: Literal["mean", "median"] = "median"
    default_categorical_strategy: Literal["most_frequent"] = "most_frequent"
    scaling: ScalingConfig = Field(default_factory=ScalingConfig)
    encoding: Literal["onehot", "ordinal"] = "onehot"
    drop_columns: list[str] = Field(default_factory=list)

    @field_validator("column_strategies")
    @classmethod
    def strategies_canonical(cls, value: dict[str, ColumnStrategy]) -> dict[str, ColumnStrategy]:
        for column, strategy in value.items():
            if strategy.strategy not in CANONICAL_STRATEGIES:  # défense en profondeur
                raise ValueError(f"Stratégie inconnue pour {column} : {strategy.strategy}")
        return value


@dataclass
class PreprocessResult:
    X_train: pd.DataFrame
    X_test: pd.DataFrame
    y_train: Any
    y_test: Any
    pipeline: ColumnTransformer
    feature_names: list[str]
    label_encoder: LabelEncoder | None
    class_names: list[str] | None
    applied: dict[str, Any] = field(default_factory=dict)  # le récapitulatif HONNÊTE
    # Index d'origine des lignes de test (dans l'ordre du split) — permet de retrouver
    # les valeurs BRUTES d'une colonne (ex. attribut sensible) alignées aux prédictions.
    test_index: list[Any] = field(default_factory=list)


def normalize_missing_tokens(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for column in df.select_dtypes(include=["object"]).columns:
        df[column] = df[column].map(
            lambda v: (
                None if isinstance(v, str) and v.strip().lower() in MISSING_VALUE_TOKENS else v
            )
        )
    return df


def _imputer_for(strategy: ColumnStrategy) -> Any:
    name = strategy.strategy
    if name == "knn":
        return KNNImputer(n_neighbors=5)
    if name == "iterative":
        return IterativeImputer(max_iter=10, random_state=RANDOM_STATE)
    if name == "constant":
        return SimpleImputer(strategy="constant", fill_value=strategy.constant_value)
    return SimpleImputer(strategy=name)  # mean | median | most_frequent


def _scaler_for(method: str) -> Any:
    return {"standard": StandardScaler(), "minmax": MinMaxScaler(), "robust": RobustScaler()}[
        method
    ]


def preprocess(df: pd.DataFrame, config: PreprocessingConfig) -> PreprocessResult:
    """Séquence EXACTE du CDC §8.3 (points 2 à 5)."""
    applied: dict[str, Any] = {
        "applied": True,
        "random_state": RANDOM_STATE,
        "steps": [],
        "column_strategies": {},
    }

    # 2a — normalisation des tokens de manquants (UN seul endroit, P3)
    df = normalize_missing_tokens(df)
    applied["steps"].append("missing_tokens_normalized")

    if config.target_column not in df.columns:
        raise InvalidInputError(
            f"Colonne cible absente : {config.target_column}", code="CLEANING_CONFIG_INVALID"
        )

    # 2b — drop_column explicites + stratégies drop_column
    to_drop = set(config.drop_columns)
    for column, strategy in config.column_strategies.items():
        if column not in df.columns:
            raise InvalidInputError(
                f"Stratégie sur colonne inconnue : {column}", code="CLEANING_CONFIG_INVALID"
            )
        if strategy.strategy == "drop_column":
            to_drop.add(column)
    to_drop.discard(config.target_column)
    if to_drop:
        df = df.drop(columns=[c for c in to_drop if c in df.columns])
        applied["steps"].append(f"drop_columns:{sorted(to_drop)}")

    # 2c — drop_rows : lignes manquantes des colonnes concernées
    drop_row_columns = [
        c
        for c, s in config.column_strategies.items()
        if s.strategy == "drop_rows" and c in df.columns
    ]
    if drop_row_columns:
        before = len(df)
        df = df.dropna(subset=drop_row_columns)
        applied["steps"].append(f"drop_rows:{drop_row_columns}:{before - len(df)}_lignes")

    # 2d — lignes à cible manquante supprimées (affiché à l'étape 3)
    before = len(df)
    df = df.dropna(subset=[config.target_column])
    if before - len(df):
        applied["steps"].append(f"target_missing_rows_dropped:{before - len(df)}")

    # 2e — exclusion des colonnes identifiantes
    id_columns = [
        c for c in df.columns if c != config.target_column and ID_COLUMN_PATTERN.match(str(c))
    ]
    if id_columns:
        df = df.drop(columns=id_columns)
        applied["steps"].append(f"id_columns_excluded:{id_columns}")

    if df.empty or df.shape[1] < 2:
        raise InvalidInputError(
            "Plus assez de données après nettoyage", code="CLEANING_CONFIG_INVALID"
        )

    # 3 — cible : classes à 1 exemplaire retirées AVANT l'encodage (avertissement affiché),
    #     puis LabelEncoder — l'espace des classes reste dense et exact
    y_raw = df[config.target_column]
    X = df.drop(columns=[config.target_column])
    label_encoder: LabelEncoder | None = None
    class_names: list[str] | None = None
    stratify = None
    if config.task_type == "classification":
        label_counts = y_raw.astype(str).value_counts()
        rare_labels = sorted(label_counts[label_counts < 2].index.tolist())
        if rare_labels:
            keep = ~y_raw.astype(str).isin(rare_labels)
            X, y_raw = X.loc[keep], y_raw.loc[keep]
            applied["steps"].append(f"single_instance_classes_removed:{rare_labels}")
        label_encoder = LabelEncoder()
        y = label_encoder.fit_transform(y_raw.astype(str))
        class_names = [str(c) for c in label_encoder.classes_]
        if pd.Series(y).value_counts().min() >= 2:
            stratify = y
    else:
        try:
            y = pd.to_numeric(y_raw)
        except (ValueError, TypeError) as exc:
            raise InvalidInputError(
                f"Cible non numérique pour une régression : {config.target_column}",
                code="CLEANING_CONFIG_INVALID",
            ) from exc

    # 4 — split stratifié, random_state=42 (P4)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=config.test_size, random_state=RANDOM_STATE, stratify=stratify
    )
    applied["steps"].append(f"split:test_size={config.test_size},stratified={stratify is not None}")
    # Index d'origine des lignes de test, AVANT la transformation (qui réinitialise l'index).
    test_index = list(X_test.index)

    # 5 — ColumnTransformer par groupe de stratégie — FIT SUR TRAIN UNIQUEMENT
    numeric_columns = [c for c in X.columns if pd.api.types.is_numeric_dtype(X[c])]
    categorical_columns = [c for c in X.columns if c not in numeric_columns]

    transformers: list[tuple[str, Pipeline, list[str]]] = []
    # Groupement par stratégie COMPLÈTE (constant_value inclus — un imputer par valeur)
    grouped: dict[tuple[str, str], tuple[ColumnStrategy, list[str]]] = {}
    for column in numeric_columns:
        strategy = config.column_strategies.get(
            column, ColumnStrategy(strategy=config.default_numeric_strategy)
        )
        if strategy.strategy in ("drop_rows", "drop_column"):
            strategy = ColumnStrategy(strategy=config.default_numeric_strategy)
        group_key = (strategy.strategy, str(strategy.constant_value))
        grouped.setdefault(group_key, (strategy, []))[1].append(column)
        applied["column_strategies"][column] = strategy.strategy
    for index, (strategy, columns) in enumerate(grouped.values()):
        steps: list[tuple[str, Any]] = [("imputer", _imputer_for(strategy))]
        if config.scaling.enabled:
            steps.append(("scaler", _scaler_for(config.scaling.method)))
        transformers.append((f"num_{strategy.strategy}_{index}", Pipeline(steps), columns))

    if categorical_columns:
        for column in categorical_columns:
            cat_strategy = config.column_strategies.get(column)
            name = cat_strategy.strategy if cat_strategy else config.default_categorical_strategy
            if name in ("mean", "median", "knn", "iterative"):
                name = "most_frequent"  # inapplicable au catégoriel → repli DOCUMENTÉ
            applied["column_strategies"][column] = name
        encoder = (
            OneHotEncoder(handle_unknown="ignore", sparse_output=False)
            if config.encoding == "onehot"
            else OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
        )
        transformers.append(
            (
                "cat",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("encoder", encoder),
                    ]
                ),
                categorical_columns,
            )
        )

    pipeline = ColumnTransformer(transformers=transformers, remainder="drop")
    X_train_t = pipeline.fit_transform(X_train)  # fit sur train UNIQUEMENT (pas de fuite)
    X_test_t = pipeline.transform(X_test)
    applied["steps"].append(
        f"pipeline_fit_on_train_only:scaling={config.scaling.enabled}:"
        f"{config.scaling.method if config.scaling.enabled else 'none'}:encoding={config.encoding}"
    )

    feature_names = [str(n) for n in pipeline.get_feature_names_out()]
    return PreprocessResult(
        X_train=pd.DataFrame(X_train_t, columns=feature_names),
        X_test=pd.DataFrame(X_test_t, columns=feature_names),
        y_train=y_train,
        y_test=y_test,
        pipeline=pipeline,
        feature_names=feature_names,
        label_encoder=label_encoder,
        class_names=class_names,
        applied=applied,
        test_index=test_index,
    )
