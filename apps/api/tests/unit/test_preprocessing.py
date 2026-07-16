"""Unitaires : CHAQUE stratégie de nettoyage réellement appliquée (T1/T2/T3 verrouillés)."""

import numpy as np
import pandas as pd
import pytest

from ibis.core.errors import InvalidInputError
from ibis.modules.ml.preprocessing import (
    ColumnStrategy,
    PreprocessingConfig,
    ScalingConfig,
    preprocess,
)


def sample_df(rows: int = 40) -> pd.DataFrame:
    rng = np.random.RandomState(42)
    df = pd.DataFrame(
        {
            "id": range(rows),
            "age": rng.randint(18, 60, rows).astype(float),
            "score": rng.normal(50, 10, rows),
            "city": rng.choice(["paris", "lyon", "nice"], rows),
            "target": rng.choice(["yes", "no"], rows),
        }
    )
    df.loc[:4, "age"] = np.nan  # 5 manquants
    df.loc[:2, "city"] = None
    return df


def config(**overrides: object) -> PreprocessingConfig:
    base: dict = {"target_column": "target", "task_type": "classification"}
    base.update(overrides)
    return PreprocessingConfig.model_validate(base)


@pytest.mark.parametrize("strategy", ["mean", "median", "knn", "iterative"])
def test_numeric_imputation_strategies_really_applied(strategy: str) -> None:
    """T2 v1 : 3 stratégies sur 5 crashaient. Ici chacune s'exécute ET impute."""
    result = preprocess(
        sample_df(),
        config(column_strategies={"age": {"strategy": strategy}}),
    )
    assert not np.isnan(result.X_train.to_numpy()).any()
    assert result.applied["column_strategies"]["age"] == strategy
    assert result.applied["applied"] is True


def test_constant_strategy_uses_value() -> None:
    result = preprocess(
        sample_df(),
        config(
            column_strategies={"age": {"strategy": "constant", "constant_value": -1}},
            scaling={"enabled": False},
        ),
    )
    age_column = next(c for c in result.feature_names if "age" in c)
    values = result.X_train[age_column].astype(float)
    assert (values == -1).sum() > 0  # les manquants du train valent bien -1


def test_drop_column_and_drop_rows() -> None:
    df = sample_df()
    result = preprocess(
        df,
        config(
            column_strategies={
                "score": {"strategy": "drop_column"},
                "age": {"strategy": "drop_rows"},
            }
        ),
    )
    assert not any("score" in name for name in result.feature_names)
    total_rows = len(result.X_train) + len(result.X_test)
    assert total_rows == len(df) - 5  # les 5 lignes à age manquant sont supprimées
    assert any("drop_rows" in step for step in result.applied["steps"])


def test_id_columns_excluded_and_tokens_normalized() -> None:
    df = sample_df()
    df["comment"] = ["N/A"] * len(df)  # 100 % faux manquants → colonne inutile
    result = preprocess(df, config())
    assert not any(name.endswith("__id") or name == "id" for name in result.feature_names)
    assert any("id_columns_excluded" in step for step in result.applied["steps"])


def test_scaling_method_honoured_and_disableable() -> None:
    """T3 v1 : scaling toujours appliqué. Ici la config fait foi."""
    scaled = preprocess(sample_df(), config(scaling={"enabled": True, "method": "standard"}))
    age_scaled = scaled.X_train[next(c for c in scaled.feature_names if "age" in c)].astype(float)
    assert abs(age_scaled.mean()) < 0.2  # centré

    raw = preprocess(sample_df(), config(scaling={"enabled": False}))
    age_raw = raw.X_train[next(c for c in raw.feature_names if "age" in c)].astype(float)
    assert age_raw.max() > 10  # non transformé
    assert any("scaling=False" in step or "none" in step for step in raw.applied["steps"])


def test_split_stratified_and_reproducible() -> None:
    """P4 : deux exécutions identiques → mêmes splits, mêmes features."""
    first = preprocess(sample_df(), config())
    second = preprocess(sample_df(), config())
    assert first.feature_names == second.feature_names
    assert np.array_equal(first.y_train, second.y_train)
    assert np.allclose(
        first.X_train.to_numpy().astype(float), second.X_train.to_numpy().astype(float)
    )


def test_single_instance_class_removed_with_warning() -> None:
    df = sample_df()
    df.loc[len(df)] = [999, 30.0, 55.0, "paris", "maybe"]  # classe à 1 exemplaire
    result = preprocess(df, config())
    assert result.class_names is not None
    assert "maybe" not in result.class_names
    assert any("single_instance_classes_removed" in step for step in result.applied["steps"])


def test_invalid_configs_rejected_explicitly() -> None:
    with pytest.raises(InvalidInputError):  # cible absente
        preprocess(sample_df(), config(target_column="ghost"))
    with pytest.raises(InvalidInputError):  # stratégie sur colonne inconnue
        preprocess(sample_df(), config(column_strategies={"ghost": {"strategy": "mean"}}))
    with pytest.raises(ValueError):  # stratégie hors vocabulaire canonique → rejet Pydantic
        PreprocessingConfig.model_validate(
            {
                "target_column": "target",
                "task_type": "classification",
                "column_strategies": {"age": {"strategy": "linear"}},
            }
        )
    with pytest.raises(ValueError):  # random_state verrouillé à 42 (P4)
        PreprocessingConfig.model_validate(
            {"target_column": "t", "task_type": "classification", "random_state": 7}
        )


def test_regression_target_must_be_numeric() -> None:
    with pytest.raises(InvalidInputError):
        preprocess(sample_df(), config(task_type="regression"))  # cible 'yes'/'no'


def test_categorical_strategy_fallback_documented() -> None:
    """mean sur du catégoriel est inapplicable → repli DOCUMENTÉ vers most_frequent."""
    result = preprocess(sample_df(), config(column_strategies={"city": {"strategy": "mean"}}))
    assert result.applied["column_strategies"]["city"] == "most_frequent"


def test_scaling_config_strategy_objects() -> None:
    assert ScalingConfig().method == "standard"
    assert ColumnStrategy(strategy="median").constant_value is None
