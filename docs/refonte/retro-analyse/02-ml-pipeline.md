# Rétro-ingénierie — ml-pipeline-service (IBIS-X)

## Vue d'ensemble
FastAPI (port 8082) + Celery worker (Redis broker/backend), PostgreSQL partagé ibis_x_db, MinIO, LLM OpenRouter/OpenAI. Auth header X-User-ID. 2 tables (experiments, data_quality_analyses), 2 algorithmes réels (decision_tree, random_forest). Traces de refonte en cours (contrat v2, audits T13/T14/T18/T21, principes P1/P2/P3/P5).

## 1. Pipeline « 9 étapes » — TROIS référentiels concurrents !
### a) 9 étapes « marketing » (ml-pipeline-presentation.component.ts:93-212)
0 Data Collection / 1 Data Exploration / 2 Data Preprocessing / 3 Feature Selection / 4 Data Splitting / 5 Model Selection / 6 Model Training / 7 Model Evaluation / 8 Model Explainability.
⚠️ Étapes 1 et 3 (+ biais/équité) NON implémentées backend — promesses UI.
### b) 9 étapes wizard « historique » (memoire/ML_Pipeline_Documentation_Complete.md)
1 Dataset Overview / 2 Data Configuration (cible + tâche + assistance IA) / 3 Data Cleaning / 4 Algorithm Selection / 5 Hyperparameters / 6 Hidden Step / 7 Hidden Step / 8 Summary / 9 Training Console.
### c) Wizard RÉEL refondu : 6 étapes (wizard-state.service.ts:87-154)
1 Dataset & Objectif / 2 Nettoyage (bloquant) / 3 Division & Préparation (test_size, scaling, encoding) / 4 Algorithme / 5 Hyperparamètres / 6 Entraînement (console/polling).
+ doublon ml-studio 4 étapes (audit T17). → Refonte : trancher.

## 2. Endpoints
- GET /, /health, /monitoring/metrics (psutil + Celery), /metrics (Prometheus), /celery/status (workers + llen ml_queue)
- POST /experiments (ExperimentCreate → pending, enfile train_model sur ml_queue ; max 5 pending/running par user → 429)
- GET /experiments/{id} (resync Celery, worker perdu >10min → failed, queue_position)
- GET /experiments/{id}/results (metrics, model_uri, visualizations, feature_importance, preprocessing_config ; 400 si non completed)
- GET /experiments/{id}/visualizations/{viz_type} (PNG streaming depuis base64 BDD)
- GET /experiments/{id}/download-model (.joblib depuis MinIO)
- GET /experiments (paginé, filtre project_id, par user)
- POST /experiments/{id}/cancel (revoke terminate=True)
- GET /experiments/{id}/versions (versions .joblib MinIO)
- GET /algorithms (2 algos + schéma hyperparamètres)
- GET /users/quotas (EN DUR : 5 simultanées, 20/jour, 100 total, 1000 Mo)
- POST /data-quality/analyze (cache 7 jours table data_quality_analyses, force_refresh, 424 si dataset indispo)
- POST /data-quality/suggest-strategy (stratégies par colonne + impact estimé)
- POST /cleaning/validate (avertissements par stratégie, sans accès données réelles)
- POST /datasets/{id}/ai-analysis (reco Classification vs Régression, LLM, ai_queue → task_id)
- POST /datasets/{id}/ai-algorithm-analysis (reco algorithme)
- POST /datasets/{id}/ai-guide (guide fiche dataset)
- GET /ai-analysis/{task_id} (polling tâches IA)

## 3. Modèle de données
### experiments
id UUID PK, user_id, project_id, dataset_id (UUID indexés NOT NULL), algorithm String(50), hyperparameters JSONB, preprocessing_config JSONB (enrichie post-run : dataset_size, feature_count, applied, classes_removed), status (pending/running/completed/failed/cancelled), progress 0-100 (jalons 10/30/50/70/90/100), task_id, error_message, metrics JSONB, artifact_uri (ex model_uri), visualizations JSONB (base64 !), feature_importance JSONB (top 20), created_at/updated_at.
### data_quality_analyses (cache 7j)
dataset_id, dataset_version, analysis_data JSONB, column_strategies JSONB, quality_score 0-100, total_rows/columns, analysis_duration_seconds, expires_at.
Pas de table runs/models : versioning implicite via arborescence MinIO.

## 4. Nettoyage des données (app/ml/preprocessing.py — cœur métier)
- MISSING_VALUE_TOKENS : '', espaces, \t, \n, null, NaN, None, undefined, N/A, NA, #N/A, missing → NaN (clean_missing_tokens). ⚠️ logique dupliquée 3 endroits.
- DataQualityAnalyzer : par colonne missing_count/%, dtype, unique, is_categorical (<10 uniques), distribution_type (normaltest + skewness : normal/symmetric/right_skewed/left_skewed/moderately_skewed).
- Recommandation auto par colonne selon % manquants :
  >70% → drop_column (conf 0.9) ; 40-70% → knn (num) / most_frequent (cat) ; 15-40% → mean si normal sinon median / most_frequent ; <15% → mean/median / most_frequent.
- Patterns manquants corrélés (corr>0.7), sévérité 0-100 (low/medium/high/critical).
- OutlierDetector : IQR (Q1-1.5·IQR / Q3+1.5·IQR) + Z-Score (seuil 3), count/%/bornes/max_zscore.
- Score qualité global : 100 − pénalité manquants (max −50) − outliers >10% (max −20/col).
- Recommandations preprocessing : outliers (iqr_capping, zscore_removal, isolation_forest), scaling_recommendation (robust si num), encoding (onehot).
- CANONICAL_STRATEGIES : mean, median, most_frequent, constant, knn, iterative, drop_rows, drop_column. Aliases legacy (mode→most_frequent, drop→drop_rows ; interpolations temporelles linear/spline/ffill/bfill → median silencieusement !).
- preprocess_data() séquence : normalisation config → drop_column → drop_rows → drop lignes cible manquante → exclusion colonnes ID (id/index/idx/row_id/item_id) → LabelEncoder cible + auto-correction task_type (object → classification) → detect_column_types (booléens string, colonnes mixtes) → ColumnTransformer (un transformer par groupe stratégie, imputer+scaler num / imputer+encoder cat, remainder='drop').
- Imputers : KNNImputer(5), IterativeImputer(10), SimpleImputer(constant/mean/median/most_frequent). Fallback cat inapplicable → most_frequent.
- PreprocessingConfig (extra=forbid) : target_column, task_type, test_size [0.1,0.5] déf 0.2, random_state=42, column_strategies {col:{strategy,constant_value}}, default_numeric_strategy=median, default_categorical_strategy=most_frequent, scaling {enabled, method}, encoding onehot|ordinal, drop_columns.

## 5. Entraînement
- 2 ALGOS EXACTEMENT (regex ^(decision_tree|random_forest)$) :
  - Decision Tree : criterion (gini/entropy, auto→squared_error en régression), max_depth 1-50 (déf 5), min_samples_split 2-100 (déf 2), min_samples_leaf 1-50 (déf 1), max_features.
  - Random Forest : n_estimators 10-500 (déf 100), max_depth 1-50 (déf 10), min_samples_split, bootstrap (déf true), max_features. Forcés : random_state=42, n_jobs=-1, oob_score=True (classif).
  - Reco LLM hors des 2 algos clampée sur random_forest.
- Tâches : classification ET régression. task_type source unique = preprocessing_config.task_type, auto-corrigé.
- Split : train_test_split, stratification auto en classif si classe min ≥2 (sinon aléatoire) ; classes <2 exemples supprimées automatiquement.
- CV : cross_validate_model (StratifiedKFold/KFold cv=5) implémentée mais NON branchée dans le flux worker (UI l'affiche pourtant, folds 3-10).
- Métriques classification : accuracy, confusion_matrix, precision/recall/f1_score (weighted), precision_macro/recall_macro/f1_macro, roc_auc (binaire ou ovr/macro), pr_auc (binaire), classification_report ; RF : oob_score, rf_metadata.
- Métriques régression : mae, mse, rmse, r2.
- Feature importance top 20 ; tree_structure (arbre complet DT / 1er arbre profondeur 4 RF, format ECharts).
- Métrique principale : classification → F1-macro ; régression → MAE.

## 6. Worker Celery
App "ibis_x_cluster", include app.tasks. JSON, UTC. soft_time_limit 7200s / time_limit 7500s. Routing : train_model→ml_queue, analyze_dataset_with_ai→ai_queue. prefetch 1, max_tasks_per_child 10, max_memory_per_child 2Go. acks_late, reject_on_worker_lost, track_started. Résultats expirent 24h. 1 worker ml (ml_queue,ai_queue) + 1 worker xai (xai_queue).
Tâches : train_model ; analyze_dataset_with_ai ; generate_dataset_guide ; analyze_algorithm_with_ai.
Progression : 10→30 (dataset chargé)→50 (preprocessing)→70 (entraîné)→90 (viz)→100. update_state PROGRESS + commit BDD.
Erreurs : auto-retry ConnectionError/Timeout (3, countdown 60, backoff), retry BDD, failed+error_message, nettoyage artefacts partiels MinIO, P1 DATASET_UNAVAILABLE explicite, détection worker perdu >10min (WORKER_LOST), annulation revoke(terminate).

## 7. Stockage artefacts
MinIO via common/storage_client.py (ABC, impl MinIO, Azure Blob prévu). Modèle : joblib dict {model, preprocessing_pipeline, feature_names, training_config}. Chemin : ibis-x-models/{project_id}/{experiment_id}/v{YYYYMMDD_HHMMSS}/model_{exp}_v{version}.joblib. Datasets lus ibis-x-datasets/ en Parquet (repli CSV). Visualisations : PAS en objet — base64 dans JSONB (impact taille lignes).

## 8. Visualisations backend (matplotlib Agg + seaborn, base64 PNG 150dpi)
Classification : matrice confusion (heatmap noms classes), ROC binaire (AUC + seuil optimal), PR binaire (iso-F1), ROC multiclasse OvR, feature importance top 20, structure arbre (ECharts JSON).
Régression : prédictions vs réelles + diagonale, résidus vs prédictions, histogramme résidus + courbe normale.
Repli : au moins matrice de confusion.

## 9. Dépendances
Python 3.11-slim. fastapi 0.104.1, sqlalchemy 2.0.23, alembic, asyncpg, celery[redis] 5.3.4, redis 4.6.0, scikit-learn 1.3.2, pandas 2.1.3, numpy 1.26.2, scipy 1.11.4, joblib, matplotlib 3.8.2, seaborn, pyarrow 14.0.1, minio, psutil, structlog, prometheus-client, openai ≥1.0, tiktoken.

## 10. Communication
- service-selection : GET /datasets/{id} (métadonnées, colonnes, storage_path, files[]), puis lecture Parquet DIRECTE dans MinIO.
- xai-engine : ml-pipeline n'appelle jamais xai ; xai consomme via GET /experiments/{id}/results + download joblib + SQL DIRECT table experiments + COPIE du code app/ml/ dans l'image worker xai (couplage fort).
- LLM : common/llm_client.py, OpenRouter défaut, modèle env (gpt-4o / gpt-4o-mini), 3 services LLM (DatasetAnalysis, AlgorithmAnalysis, DatasetGuide) avec fallback heuristique is_fallback=True.
- Gateway : X-User-ID.

## Points refonte
1. Incohérence 9/6/4 étapes ; Data Exploration & Feature Selection non implémentées.
2. 2 algorithmes seulement.
3. CV déclarée non exécutée.
4. Nettoyage dupliqué 3 endroits.
5. Visualisations base64 en PostgreSQL.
6. Interpolations temporelles → median silencieux.
7. Couplage xai (SQL direct + copie code + joblib).
8. Quotas en dur.
