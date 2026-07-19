# Spec Technique — api/experiments

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | api/experiments     |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

---

## Architecture du module

Le module `api/experiments` est organisé en quatre couches :

```
routes.py           → Validation HTTP, auth, sérialisation Pydantic
service.py          → Logique métier (quotas, crédits, cycle de vie, comparaison)
models.py           → Modèle SQLAlchemy Experiment + ExperimentLog
schemas.py          → Schémas Pydantic entrée/sortie
workers/tasks/train.py → Tâche Celery asynchrone (pipeline complet)
modules/ml/         → Moteur ML interne (algorithms, preprocessing, evaluation, quality)
```

Les routes délèguent au service, qui interagit avec la BDD via SQLAlchemy 2.0. La tâche Celery `train_experiment` ouvre sa propre session BDD (`open_session()`) et publie sa progression via `jobs_service.update_progress()` (Redis pub/sub).

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/api/ibis/modules/experiments/models.py` | Modèles SQLAlchemy : `Experiment`, `ExperimentLog`, `ExperimentStatus` | ~82 |
| `apps/api/ibis/modules/experiments/schemas.py` | Schémas Pydantic : `ExperimentCreate`, `DraftUpsert`, `ExperimentRead`, `ExperimentResults`, `CompareRequest/Response`, `LogLine` | ~109 |
| `apps/api/ibis/modules/experiments/routes.py` | 13 endpoints FastAPI (liste, draft, start, get, results, logs, cancel, delete, download, compare) | ~182 |
| `apps/api/ibis/modules/experiments/service.py` | Logique métier complète (quotas, crédits, brouillon, cycle de vie, comparaison, purge stale) | ~407 |
| `apps/api/ibis/workers/tasks/train.py` | Tâche Celery `train_experiment` (9 jalons de progression) | ~187 |
| `apps/api/ibis/modules/ml/algorithms.py` | Registre d'algorithmes (`REGISTRY`), `build_estimator`, `validate_hyperparameters`, `hyperparameter_schemas`, `extract_tree_structure` | ~181 |
| `apps/api/ibis/modules/ml/preprocessing.py` | `PreprocessingConfig` Pydantic, `preprocess()` (pipeline sklearn), normalisation tokens manquants | ~294 |
| `apps/api/ibis/modules/ml/evaluation.py` | `evaluate_classification`, `evaluate_regression`, `feature_importances`, `composite_score` | ~171 |
| `apps/api/ibis/tests/integration/test_experiments_api.py` | Tests d'intégration M5 (cycle complet, déterminisme, quotas, crédits, draft, qualité, comparaison, isolation) | ~380 |

---

## Schéma BDD

### Table `experiments`

| Colonne | Type | Rôle |
|---------|------|------|
| `id` | UUID PK | Identifiant de l'expérience |
| `user_id` | UUID FK → users (CASCADE) | Isolation utilisateur |
| `project_id` | UUID FK → projects (CASCADE) | Regroupement par projet |
| `dataset_id` | UUID FK → datasets (CASCADE) | Dataset source |
| `algorithm` | VARCHAR(50) nullable | Clé du registre (`decision_tree`, `random_forest`) |
| `hyperparameters` | JSONB | Hyperparamètres validés par le schéma Pydantic |
| `preprocessing_config` | JSONB | Configuration de préprocessing (ex. `PreprocessingConfig.model_dump()`) |
| `status` | ENUM | `draft` / `pending` / `running` / `completed` / `failed` / `cancelled` |
| `progress` | SMALLINT | Progression 0–100 (jalons : 10, 30, 50, 70, 90, 100) |
| `job_id` | UUID nullable | Référence vers `jobs.id` (suivi SSE) |
| `task_id` | VARCHAR(155) nullable | ID Celery (pour `control.revoke`) |
| `error_code` | VARCHAR(64) nullable | Code d'erreur typé (ex. `WORKER_LOST`, `TIMEOUT`, `DATASET_UNAVAILABLE`) |
| `error_message` | TEXT nullable | Message humain de l'erreur |
| `metrics` | JSONB nullable | Métriques de performance (ex. `f1_macro`, `accuracy`, `mae`) |
| `viz_data` | JSONB nullable | Données de visualisation JSON (matrice, courbes, importance) — jamais d'images |
| `feature_importance` | JSONB nullable | Top 20 features avec importance Gini et rang |
| `applied_preprocessing` | JSONB nullable | Récapitulatif honnête du préprocessing effectivement appliqué |
| `artifact_key` | VARCHAR(512) nullable | Clé de stockage du modèle (ex. `models/{id}/model.joblib`) |
| `draft_state` | JSONB nullable | État du store wizard côté client (source unique, P3) — effacé au lancement |
| `started_at` | TIMESTAMP nullable | Début effectif de l'entraînement |
| `finished_at` | TIMESTAMP nullable | Fin de l'entraînement (succès, échec ou annulation) |
| `duration_seconds` | FLOAT nullable | Durée mesurée par `time.perf_counter()` |
| `created_at`, `updated_at` | TIMESTAMP | Gérés par le mixin `Timestamped` |

**Index** : `user_id`, `project_id`, `dataset_id`, `status`.

### Table `experiment_logs`

| Colonne | Type | Rôle |
|---------|------|------|
| `id` | UUID PK | |
| `experiment_id` | UUID FK → experiments (CASCADE) | |
| `ts` | TIMESTAMP | `server_default="now()"` |
| `level` | VARCHAR(10) | `info` / `error` |
| `message` | VARCHAR(512) | Tronqué à 512 caractères |

---

## API / Endpoints

| Méthode | Route | operation_id | Description | Auth |
|---------|-------|--------------|-------------|------|
| GET | `/algorithms` | `listAlgorithms` | Cartes + schémas hyperparamètres (source formulaire wizard É6-7) | JWT (claims) |
| GET | `/datasets/{id}/quality-analysis` | `getQualityAnalysis` | Analyse qualité, cache 7 j, `?force=true` pour invalider | JWT (claims) |
| PUT | `/experiments/draft` | `upsertDraft` | Crée ou met à jour le brouillon du wizard (P5) | JWT (claims) |
| GET | `/experiments/draft` | `getDraft` | Récupère le brouillon pour reprise (`?project_id=&dataset_id=`) | JWT (claims) |
| POST | `/experiments` | `startExperiment` | Valide, débite crédit, enqueue Celery | JWT (user) |
| GET | `/experiments` | `listExperiments` | Liste globale, brouillons exclus, filtres `status/project_id/algorithm`, max 200 | JWT (claims) |
| GET | `/experiments/{id}` | `getExperiment` | Détail + position dans la queue (`queue_position`) | JWT (claims) |
| GET | `/experiments/{id}/results` | `getExperimentResults` | Métriques + viz + importance + composite (completed uniquement) | JWT (claims) |
| GET | `/experiments/{id}/logs` | `getExperimentLogs` | Journal d'entraînement chronologique | JWT (claims) |
| POST | `/experiments/{id}/cancel` | `cancelExperiment` | Révoque la tâche Celery, rembourse si pending | JWT (user) |
| DELETE | `/experiments/{id}` | `deleteExperiment` | Supprime expérience + artefact (bloqué si active) | JWT (claims) |
| GET | `/experiments/{id}/download-model` | `downloadModel` | Stream `model.joblib` depuis le stockage | JWT (claims) |
| POST | `/experiments/compare` | `compareExperiments` | Benchmarking N expériences (2–8), métriques alignées | JWT (claims) |
| GET | `/projects/{id}/experiments` | `listProjectExperiments` | Expériences d'un projet (brouillons exclus) | JWT (claims) |

**Distinction `CurrentClaims` vs `CurrentUser`** : les routes qui mutent le solde de crédits ou soumettent des tâches Celery utilisent `CurrentUser` (full user object depuis BDD) ; les routes read-only utilisent `CurrentClaims` (JWT décodé, sans requête BDD).

---

## Pipeline d'entraînement Celery (train.py)

**Jalons de progression** :

| Valeur | Étape |
|--------|-------|
| 5 | Job passé en `running` |
| 10 | Chargement du dataset |
| 30 | Données chargées (N lignes) |
| 50 | Préprocessing appliqué |
| 70 | Modèle entraîné |
| 90 | Évaluation terminée, sérialisation artefact |
| 100 | Terminé |

**Contrat de la tâche** :
- `acks_late=True` : le message n'est acquitté qu'en fin de traitement (pas de perte en cas de crash).
- `autoretry_for=(ConnectionError, TimeoutError)` avec 3 retry (délai 60 s) — **uniquement pour les erreurs réseau**, pas pour les erreurs de données ou d'algorithme.
- `soft_time_limit=training_timeout_seconds`, `time_limit=+300s` : deux niveaux de timeout (SoftTimeLimitExceeded déclenche `_fail` proprement).
- En cas d'échec, `_fail()` supprime l'artefact partiel, passe l'expérience en `failed`, enregistre un log `error`, et notifie le job.

**Structure de l'artefact `.joblib`** :
```python
{
    "model": estimator,                      # instance sklearn entraînée
    "preprocessing_pipeline": ColumnTransformer,
    "label_encoder": LabelEncoder | None,
    "feature_names": list[str],
    "class_names": list[str] | None,
    "training_config": {
        "algorithm": str,
        "hyperparameters": dict,
        "preprocessing": dict,
        "random_state": 42,
    },
}
```

---

## Patterns identifiés

- **Service Layer** : la logique métier est entièrement dans `service.py`, les routes ne font que valider et sérialiser.
- **Registre d'extensibilité** : `REGISTRY` dans `algorithms.py` — ajouter un algorithme = 1 wrapper + 1 entrée dans le dictionnaire.
- **Upsert idempotent** : `upsert_draft` et `start_experiment` sont idempotents sur le triplet (user, project, dataset) à statut `draft`.
- **Comparaison par intersection de métriques** : `compare()` n'expose que les métriques présentes dans TOUTES les expériences comparées (set intersection), puis les ordonne selon une liste fixe de préférence.
- **Score composite** : `composite_score()` normalise la métrique primaire en 0–100 et attribue un label (`excellent / good / fair / needs_improvement`). Méthode affichée en tooltip côté client.
- **Isolation tenant stricte** : toutes les requêtes filtrent `Experiment.user_id == user_id`. Aucune expérience n'est visible entre utilisateurs (vérifié par `test_isolation_between_users`).

---

## Décisions d'implémentation documentées (hors ADR)

- **Viz data en JSON natif, jamais en image** : `viz_data` (JSONB) contient uniquement des données numériques sérialisées (matrices, courbes de points, histogrammes). Les visualisations sont rendues côté client par Recharts. Commentaire `[NE PAS REPRODUIRE]` dans `evaluation.py` : ne pas stocker de PNG base64 en BDD.
- **Fit du pipeline sur le train set uniquement** : `pipeline.fit_transform(X_train)` puis `pipeline.transform(X_test)` — le test set n'est jamais vu par le pipeline lors du fit (pas de data leakage). Documenté dans le code comme `# FIT SUR TRAIN UNIQUEMENT (pas de fuite)`.
- **Stratification conditionnelle du split** : le split train/test est stratifié (par classes de la cible) seulement si chaque classe a au minimum 2 exemplaires. Les classes à 1 seul exemplaire sont retirées avant le split avec un log dans `applied`.
- **Repli silencieux pour les stratégies catégorielles inapplicables** : si une stratégie numérique (`mean`, `median`, `knn`, `iterative`) est affectée à une colonne catégorielle, elle est remplacée par `most_frequent` avec traçabilité dans `applied.column_strategies`.
- **Structure d'arbre exportée en JSON profondeur max 4** : `extract_tree_structure()` exporte le premier arbre d'un RandomForest (profondeur ≤ 4) ou l'arbre complet d'un DecisionTree (borné à 4 niveaux) pour visualisation.
- **Purge WORKER_LOST** : `purge_stale_running()` passe en `failed` les expériences `running` dont le champ `updated_at` n'a pas bougé depuis 10 minutes (seuil configurable).
- **Queue dédiée `training`** : la tâche est soumise via `.apply_async(queue="training")`. Celery dispose de 4 queues distinctes (`training`, `xai`, `llm`, `maintenance`).

---

## Algorithmes disponibles (v2)

| Clé | Tâches | Badge | Hyperparamètres |
|-----|--------|-------|-----------------|
| `decision_tree` | classification, regression | `max_explainability` | `criterion` (gini/entropy), `max_depth` (1–50), `min_samples_split` (2–100), `min_samples_leaf` (1–50) |
| `random_forest` | classification, regression | `recommended` | `n_estimators` (10–500), `max_depth` (1–50), `min_samples_split` (2–100), `bootstrap` (bool) |

Trois presets par algorithme : `balanced`, `high_precision`, `fast`. Les presets sont servis par `GET /algorithms` et affichés en étape 7 du wizard.

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|----------------|--------|
| `tests/integration/test_experiments_api.py` | Cycle complet (happy path), déterminisme (2 runs → métriques identiques), quotas et crédits, annulation + remboursement, dataset indisponible → échec explicite, config de nettoyage invalide → échec explicite, algorithme inconnu → rejet, brouillon/reprise, cache analyse qualité, comparaison, isolation entre utilisateurs | Existant |
| `tests/unit/test_preprocessing.py` | Logique de `preprocess()` (nettoyage, split, stratification, pipeline) | Existant |
| `tests/unit/test_ml_quality_and_eval.py` | `evaluate_classification`, `evaluate_regression`, `composite_score`, qualité dataset | Existant |
