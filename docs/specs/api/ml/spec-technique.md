# Spec Technique — api/ml

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | api/ml              |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

---

## Architecture du module

`api/ml` est un module purement interne (pas de routes FastAPI). Il est composé de 5 fichiers sources plus un fichier vocabulaire, et d'une tâche Celery dans `workers/tasks/train.py` qui orchestre le pipeline complet.

```
ibis/modules/ml/
├── vocab.py          — vocabulaire canonique partagé (MISSING_VALUE_TOKENS, CANONICAL_STRATEGIES)
├── preprocessing.py  — nettoyage + split + ColumnTransformer → PreprocessResult
├── algorithms.py     — REGISTRY + build_estimator() + hyperparameter_schemas()
├── evaluation.py     — métriques classification/régression + viz JSON
└── quality.py        — analyse qualité dataset + cache 7 j

ibis/workers/tasks/
└── train.py          — tâche Celery qui orchestre les 5 modules ci-dessus
```

**Flux de données dans la tâche d'entraînement** :
```
DataFrame (fichier)
    → preprocessing.preprocess()         → PreprocessResult
    → algorithms.build_estimator()       → estimateur sklearn seedé
    → estimator.fit(X_train, y_train)    → modèle entraîné
    → evaluation.evaluate_*()            → (metrics dict, viz dict)
    → joblib.dump({model, pipeline, ...})→ artefact sur storage
    → Experiment.metrics / viz_data      → persisté en BDD
```

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/api/ibis/modules/ml/vocab.py` | Vocabulaire canonique : tokens de faux manquants + 8 stratégies légales | ~43 |
| `apps/api/ibis/modules/ml/preprocessing.py` | Pipeline sklearn complet : nettoyage, split, ColumnTransformer, retour PreprocessResult | ~294 |
| `apps/api/ibis/modules/ml/algorithms.py` | Registre REGISTRY, build_estimator, validation hyperparamètres, schémas JSON, export arbre | ~181 |
| `apps/api/ibis/modules/ml/evaluation.py` | Métriques sklearn + courbes ROC/PR + scatter + histogramme résidus + importance features | ~171 |
| `apps/api/ibis/modules/ml/quality.py` | Analyse qualité par colonne (distribution, outliers IQR+z-score, reco stratégie) + cache BDD | ~173 |
| `apps/api/ibis/workers/tasks/train.py` | Tâche Celery `train_experiment` : orchestration séquence, progression, sérialisation artefact | ~187 |

---

## Schéma BDD (tables utilisées)

| Table | Colonnes clés | Usage |
|-------|---------------|-------|
| `experiments` | `metrics` (JSONB), `viz_data` (JSONB), `applied_preprocessing` (JSONB), `artifact_key` (str), `feature_importance` (JSONB), `progress` (int), `status` (enum), `error_code`, `error_message` | Résultats écrits par la tâche d'entraînement |
| `quality_analyses` | `dataset_id` (UUID FK), `analysis` (JSONB), `quality_score` (float), `column_recommendations` (JSONB), `computed_at`, `expires_at` | Cache 7 jours de l'analyse qualité |

---

## API / Endpoints (indirects — pas de routes ML directes)

Le module `api/ml` n'expose pas de routes HTTP. Il est consommé via :

| Appelant | Méthode | Route | Ce qui utilise api/ml |
|----------|---------|-------|-----------------------|
| experiments/routes | GET | `/api/v1/algorithms` | `hyperparameter_schemas()` |
| experiments/routes | POST | `/api/v1/experiments/{id}/quality` | `get_or_compute_quality()` |
| workers/tasks/train | Celery | — | Pipeline complet preprocessing + training + evaluation |
| workers/tasks/explain | Celery | — | `preprocess()` pour réaligner les features XAI |

---

## Patterns identifiés

### Registre d'algorithmes (Registry pattern)

Chaque algorithme est un `AlgorithmSpec` (dataclass frozen) avec une clé, un modèle Pydantic de paramètres et une liste de tâches supportées. `REGISTRY` est un dict statique. Ajouter un algorithme = créer la classe Pydantic de params + ajouter une entrée au dict + implémenter la branche dans `build_estimator()`.

```python
REGISTRY: dict[str, AlgorithmSpec] = {
    "decision_tree": AlgorithmSpec(key="decision_tree", params_model=DecisionTreeParams),
    "random_forest": AlgorithmSpec(key="random_forest", params_model=RandomForestParams),
}
```

### Séquence de nettoyage déterministe (CDC §8.3)

`preprocessing.preprocess()` suit une séquence stricte et numérotée, documentée dans le CDC §8.3 :
1. Normalisation tokens manquants
2. Drop colonnes explicites / stratégie drop_column
3. Drop lignes (stratégie drop_rows)
4. Drop lignes à cible manquante
5. Exclusion colonnes identifiantes (pattern regex `^(id|index|idx|row_id|item_id|.*_id)$`)
6. Retrait classes à instance unique (classification)
7. Encodage de la cible (LabelEncoder / pd.to_numeric)
8. Split stratifié (random_state=42, test_size configurable 10–50 %)
9. ColumnTransformer (groupement par stratégie, fit sur train uniquement)

### Récapitulatif appliqué (Honest Summary pattern)

Toutes les transformations appliquées sont tracées dans le dict `applied` retourné par `preprocess()` :
- `applied["applied"] = True`
- `applied["random_state"] = 42`
- `applied["steps"]` : liste ordonnée des opérations effectuées avec leurs paramètres
- `applied["column_strategies"]` : stratégie réellement appliquée par colonne (post-repli catégoriel inclus)

Ce dict est persisté dans `experiments.applied_preprocessing` et affiché à l'utilisateur au résumé de l'étape 3.

### Cache-ou-calcul (Cache-aside pattern)

`quality.get_or_compute_quality()` vérifie d'abord la table `quality_analyses`. Si le cache n'est pas expiré (< 7 jours), retourne directement. Sinon, recompute, persiste et retourne. Invalidable par `force=True`.

### Sérialisation artefact (Snapshot joblib)

La tâche d'entraînement sérialise un dict complet `{model, preprocessing_pipeline, label_encoder, feature_names, class_names, training_config}` via `joblib.dump()` dans un buffer mémoire, puis l'envoie sur le storage (`models/{experiment_id}/model.joblib`). En cas d'échec, l'artefact partiel est supprimé via `get_storage().delete()`.

---

## Métriques calculées

### Classification

| Métrique | Description | Métrique primaire |
|----------|-------------|:-----------------:|
| `accuracy` | Exactitude globale | |
| `precision` (weighted) | Précision pondérée par support | |
| `recall` (weighted) | Rappel pondéré | |
| `f1_score` (weighted) | F1 pondéré | |
| `f1_macro` | F1 macro (poids égaux par classe) | **oui** |
| `roc_auc` | AUC-ROC (binaire : score positif ; multiclasse : OVR macro) | |
| `pr_auc` | AUC-PR (binaire uniquement) | |
| `oob_score` | Score out-of-bag (RandomForest + bootstrap uniquement) | |
| `per_class` | Précision / rappel / F1 par classe | |

Visualisations : matrice de confusion, courbe ROC (binaire), courbe PR (binaire), importance features (top 20).

### Régression

| Métrique | Description | Métrique primaire |
|----------|-------------|:-----------------:|
| `mae` | Erreur absolue moyenne | **oui** |
| `mse` | Erreur quadratique moyenne | |
| `rmse` | Racine de MSE | |
| `r2` | Coefficient de détermination | |

Visualisations : scatter prédit vs réel, résidus vs prédit, histogramme résidus.

### Score composite (CDC §8.2 É9)

| Tâche | Formule | Seuils |
|-------|---------|--------|
| Classification | `f1_macro × 100` | ≥90 excellent, ≥75 good, ≥60 fair, <60 needs_improvement |
| Régression | `max(0, R²) × 100` | idem |

### Qualité dataset

Score global = `100 − pénalité_manquants (max 50) − pénalité_outliers (max 40)`.

Outliers détectés par double critère : IQR (1.5×IQR) ET z-score (seuil = 3.0). Une colonne numérique avec > 10 % d'outliers contribue à hauteur de 20 points de pénalité.

Matrice de recommandation de stratégie par colonne :

| % manquants | Numérique | Catégoriel |
|-------------|-----------|------------|
| > 70 % | drop_column | drop_column |
| 40–70 % | knn | most_frequent |
| 15–40 % | mean (normal) / median (autre) | most_frequent |
| < 15 % | mean (normal) / median (autre) | most_frequent |

---

## Gestion des erreurs

| Situation | Code d'erreur | Comportement |
|-----------|---------------|--------------|
| Algorithme inconnu | `UNKNOWN_ALGORITHM` | `InvalidInputError` levée par `validate_hyperparameters()` |
| Hyperparamètre invalide | `INVALID_HYPERPARAMETERS` | `InvalidInputError` levée par `validate_hyperparameters()` |
| Colonne cible absente | `CLEANING_CONFIG_INVALID` | `InvalidInputError` dans `preprocess()` |
| Stratégie sur colonne inconnue | `CLEANING_CONFIG_INVALID` | `InvalidInputError` dans `preprocess()` |
| Cible non numérique (régression) | `CLEANING_CONFIG_INVALID` | `InvalidInputError` dans `preprocess()` |
| Dataset sans fichier | `DATASET_NO_FILE` | `NotFoundError` dans `get_or_compute_quality()` |
| DataFrame vide après nettoyage | `CLEANING_CONFIG_INVALID` | `InvalidInputError` dans `preprocess()` |
| Timeout entraînement | `TIMEOUT` | `SoftTimeLimitExceeded` → `_fail()` + nettoyage artefact partiel |
| Erreur inattendue | `INTERNAL_ERROR` | Exception loguée (`logger.exception`) → `_fail()` |

---

## Configurations

### `PreprocessingConfig` (Pydantic, extra="forbid")

| Champ | Type | Défaut | Contrainte |
|-------|------|--------|------------|
| `target_column` | str | requis | doit exister dans le DataFrame |
| `task_type` | Literal["classification","regression"] | requis | |
| `test_size` | float | 0.2 | [0.1, 0.5] |
| `random_state` | Literal[42] | 42 | verrouillé (P4) |
| `column_strategies` | dict[str, ColumnStrategy] | {} | clés = colonnes existantes, valeurs parmi CANONICAL_STRATEGIES |
| `default_numeric_strategy` | Literal["mean","median"] | "median" | |
| `default_categorical_strategy` | Literal["most_frequent"] | "most_frequent" | |
| `scaling` | ScalingConfig | {enabled: True, method: "standard"} | method parmi standard/minmax/robust |
| `encoding` | Literal["onehot","ordinal"] | "onehot" | |
| `drop_columns` | list[str] | [] | |

### `DecisionTreeParams` (extra="forbid")

| Champ | Défaut | Borne |
|-------|--------|-------|
| `criterion` | "gini" | gini / entropy |
| `max_depth` | 5 | [1, 50] |
| `min_samples_split` | 2 | [2, 100] |
| `min_samples_leaf` | 1 | [1, 50] |

### `RandomForestParams` (extra="forbid")

| Champ | Défaut | Borne |
|-------|--------|-------|
| `n_estimators` | 100 | [10, 500] |
| `max_depth` | 10 | [1, 50] |
| `min_samples_split` | 2 | [2, 100] |
| `bootstrap` | True | bool |

### Presets (étape 7 du wizard)

| Algo | Preset | Paramètres |
|------|--------|-----------|
| decision_tree | balanced | max_depth=5, min_samples_split=2, min_samples_leaf=1 |
| decision_tree | high_precision | max_depth=15, min_samples_split=2, min_samples_leaf=1 |
| decision_tree | fast | max_depth=3, min_samples_split=10, min_samples_leaf=5 |
| random_forest | balanced | n_estimators=100, max_depth=10 |
| random_forest | high_precision | n_estimators=300, max_depth=20 |
| random_forest | fast | n_estimators=30, max_depth=6 |

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|----------------|--------|
| `apps/api/tests/unit/test_preprocessing.py` | Chaque stratégie d'imputation réellement appliquée (T1/T2/T3), split reproductible, drop lignes/colonnes, exclusion colonnes id, scaling activable/désactivable, repli catégoriel documenté, configs invalides rejetées, random_state verrouillé | Existant |
| `apps/api/tests/unit/test_ml_quality_and_eval.py` | Analyse qualité (score, reco stratégie, outliers), métriques classification/régression, score composite, feature_importances | Existant |
| Tests d'intégration train pipeline | Pipeline complet train → évaluation → artefact | A vérifier (non localisé directement) |

---

## Décisions techniques hors ADR (spec-technique uniquement)

- **`TREE_EXPORT_MAX_DEPTH = 4`** : l'export JSON de la structure d'arbre est borné à 4 niveaux de profondeur pour maîtriser la taille du JSON et la lisibilité dans la UI. Pour RandomForest, seul le premier estimateur (`model.estimators_[0]`) est exporté, avec une note `"1 arbre sur N"`.
- **`VIZ_MAX_POINTS = 200`** : les courbes ROC, PR et scatter sont sous-échantillonnées à 200 points par interpolation linéaire (`np.linspace`) pour limiter le poids des données JSON envoyées au client.
- **`TOP_FEATURES = 20`** : seules les 20 features les plus importantes (Gini natif) sont renvoyées, triées par importance décroissante.
- **`oob_score` conditionnel** : le score OOB de RandomForest est activé uniquement si `bootstrap=True` dans les hyperparamètres (`oob_score=validated_rf.bootstrap`).
- **`n_jobs=-1` pour RandomForest** : le parallélisme sklearn est activé (tous les CPU) pour RandomForest, non pour DecisionTree.
- **Repli catégoriel vers `most_frequent`** : stratégies `mean`, `median`, `knn`, `iterative` inapplicables au catégoriel sont silencieusement remplacées par `most_frequent` avec trace dans `applied.column_strategies`.
- **AUC absente si classe manquante en test** : si une classe est absente du jeu de test, `roc_auc_score` lève une `ValueError` qui est catchée silencieusement (`pass`) — la métrique est simplement absente du résultat plutôt que d'être une erreur.
