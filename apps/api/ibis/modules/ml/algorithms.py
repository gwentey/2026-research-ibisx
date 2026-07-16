"""Registre d'algorithmes (ADR-006) — ajouter un algo = 1 wrapper + 1 entrée.

[NE PAS REPRODUIRE] T8 : la validation API n'accepte QUE les clés du registre ;
aucune recommandation hors catalogue n'est possible.
La v2 démarre avec exactement decision_tree et random_forest (décision D5).
"""

from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

RANDOM_STATE = 42  # P4
TREE_EXPORT_MAX_DEPTH = 4


class DecisionTreeParams(BaseModel):
    model_config = ConfigDict(extra="forbid")

    criterion: Literal["gini", "entropy"] = "gini"  # auto → squared_error en régression
    max_depth: int = Field(default=5, ge=1, le=50)
    min_samples_split: int = Field(default=2, ge=2, le=100)
    min_samples_leaf: int = Field(default=1, ge=1, le=50)


class RandomForestParams(BaseModel):
    model_config = ConfigDict(extra="forbid")

    n_estimators: int = Field(default=100, ge=10, le=500)
    max_depth: int = Field(default=10, ge=1, le=50)
    min_samples_split: int = Field(default=2, ge=2, le=100)
    bootstrap: bool = True


# Presets de l'étape 7 (Équilibré / Haute précision / Rapide) — CDC §8.2
PRESETS: dict[str, dict[str, dict[str, Any]]] = {
    "decision_tree": {
        "balanced": {"max_depth": 5, "min_samples_split": 2, "min_samples_leaf": 1},
        "high_precision": {"max_depth": 15, "min_samples_split": 2, "min_samples_leaf": 1},
        "fast": {"max_depth": 3, "min_samples_split": 10, "min_samples_leaf": 5},
    },
    "random_forest": {
        "balanced": {"n_estimators": 100, "max_depth": 10},
        "high_precision": {"n_estimators": 300, "max_depth": 20},
        "fast": {"n_estimators": 30, "max_depth": 6},
    },
}


def build_estimator(algorithm: str, task_type: str, params: dict[str, Any]) -> Any:
    """Construit l'estimateur sklearn seedé (P4) depuis des paramètres VALIDÉS."""
    if algorithm == "decision_tree":
        validated = DecisionTreeParams.model_validate(params)
        criterion = validated.criterion if task_type == "classification" else "squared_error"
        common = {
            "criterion": criterion,
            "max_depth": validated.max_depth,
            "min_samples_split": validated.min_samples_split,
            "min_samples_leaf": validated.min_samples_leaf,
            "random_state": RANDOM_STATE,
        }
        return (
            DecisionTreeClassifier(**common)
            if task_type == "classification"
            else DecisionTreeRegressor(**common)
        )
    if algorithm == "random_forest":
        validated_rf = RandomForestParams.model_validate(params)
        common = {
            "n_estimators": validated_rf.n_estimators,
            "max_depth": validated_rf.max_depth,
            "min_samples_split": validated_rf.min_samples_split,
            "bootstrap": validated_rf.bootstrap,
            "random_state": RANDOM_STATE,
            "n_jobs": -1,
        }
        if task_type == "classification":
            return RandomForestClassifier(oob_score=validated_rf.bootstrap, **common)
        return RandomForestRegressor(**common)
    raise KeyError(algorithm)


@dataclass(frozen=True)
class AlgorithmSpec:
    key: str
    params_model: type[BaseModel]
    supports: tuple[str, ...] = ("classification", "regression")


REGISTRY: dict[str, AlgorithmSpec] = {
    "decision_tree": AlgorithmSpec(key="decision_tree", params_model=DecisionTreeParams),
    "random_forest": AlgorithmSpec(key="random_forest", params_model=RandomForestParams),
}


def validate_hyperparameters(algorithm: str, params: dict[str, Any]) -> dict[str, Any]:
    if algorithm not in REGISTRY:
        from ibis.core.errors import InvalidInputError

        raise InvalidInputError(
            f"Algorithme inconnu : {algorithm} (registre : {', '.join(REGISTRY)})",
            code="UNKNOWN_ALGORITHM",
        )
    try:
        return REGISTRY[algorithm].params_model.model_validate(params).model_dump()
    except Exception as exc:
        from ibis.core.errors import InvalidInputError

        raise InvalidInputError(
            f"Hyperparamètres invalides pour {algorithm} : {exc}",
            code="INVALID_HYPERPARAMETERS",
        ) from exc


def hyperparameter_schemas() -> list[dict[str, Any]]:
    """Cartes servies par GET /algorithms — source du formulaire dynamique (étape 7)."""
    return [
        {
            "key": "decision_tree",
            "tasks": ["classification", "regression"],
            "badge": "max_explainability",
            "schema": DecisionTreeParams.model_json_schema(),
            "defaults": DecisionTreeParams().model_dump(),
            "presets": PRESETS["decision_tree"],
        },
        {
            "key": "random_forest",
            "tasks": ["classification", "regression"],
            "badge": "recommended",
            "schema": RandomForestParams.model_json_schema(),
            "defaults": RandomForestParams().model_dump(),
            "presets": PRESETS["random_forest"],
        },
    ]


def extract_tree_structure(
    model: Any, feature_names: list[str], class_names: list[str] | None
) -> dict[str, Any] | None:
    """Structure d'arbre JSON (DT complet borné, RF : 1er arbre profondeur ≤ 4)."""
    from sklearn.tree import _tree

    estimator = model
    note = None
    if hasattr(model, "estimators_"):
        estimator = model.estimators_[0]
        note = f"1 arbre sur {len(model.estimators_)}"
    if not hasattr(estimator, "tree_"):
        return None

    tree = estimator.tree_

    def node(index: int, depth: int) -> dict[str, Any]:
        if depth > TREE_EXPORT_MAX_DEPTH or tree.feature[index] == _tree.TREE_UNDEFINED:
            values = tree.value[index][0]
            if class_names is not None:
                label = class_names[int(values.argmax())] if len(class_names) else str(values)
                return {
                    "type": "leaf",
                    "prediction": label,
                    "samples": int(tree.n_node_samples[index]),
                }
            return {
                "type": "leaf",
                "prediction": round(float(values[0]), 4),
                "samples": int(tree.n_node_samples[index]),
            }
        feature = feature_names[tree.feature[index]]
        return {
            "type": "split",
            "feature": feature,
            "threshold": round(float(tree.threshold[index]), 4),
            "samples": int(tree.n_node_samples[index]),
            "left": node(int(tree.children_left[index]), depth + 1),
            "right": node(int(tree.children_right[index]), depth + 1),
        }

    return {"root": node(0, 1), "max_depth_exported": TREE_EXPORT_MAX_DEPTH, "note": note}
