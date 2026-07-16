# Rétro-ingénierie — service-selection (IBIS-X)

FastAPI 0.115 (Python 3.11), SQLAlchemy 2 sync + Alembic, PostgreSQL, MinIO/Azure Blob, port 8081. Pas d'auth interne : headers X-User-ID / X-User-Role injectés par gateway. main.py = 4105 lignes MONOLITHE.

## Endpoints
- GET /, /health
- GET /datasets : pagination (page, page_size 1-100 déf 12, sort_by déf dataset_name, sort_order), ~40 params de filtrage. total_pages=ceil.
- GET /datasets/domains, /datasets/tasks (agrégation ARRAY dédupliquée), /datasets/stats (totalDatasets, totalInstances, totalFiles, avgInstances/Features, domainDistribution, taskDistribution)
- GET /datasets/{id} (DatasetWithFiles : + files[] + colonnes triées par position ; consommé par ml-pipeline)
- GET /datasets/{id}/details (quality_metrics + distribution_analysis PARTIELLEMENT SIMULÉS + files)
- GET /datasets/{id}/preview (aperçu réel MinIO)
- GET /datasets/{id}/similar?limit=5 (+ similarity_explanation textuelle)
- POST /datasets/preview (pré-upload multipart : analyse sans sauvegarde, 10 lignes, suggestions domaine par mots-clés colonnes, tâche ML, quality_score)
- POST /datasets (201, multipart ~35 champs Form + files ; formats csv/xlsx/xls/json/xml/parquet, max 100MB ; conversion CSV→Parquet Snappy ; crée Dataset+DatasetFile+FileColumn ; created_by)
- PUT /datasets/{id} (ownership propriétaire ou admin), DELETE /datasets/{id} (cleanup storage + cascade)
- POST /datasets/{id}/reanalyze (repurge et réanalyse colonnes)
- GET /datasets/{id}/download/{filename}, GET /datasets/{id}/files
- POST /datasets/score (DatasetScoreRequest {filters?, weights[]} → List[DatasetScoredWithDetails] triée score desc)
- GET /projects/{id}/recommendations (criteria + weights du projet → datasets triés)
- CRUD /projects (GET liste paginée + search, POST, GET, PUT — normalise poids si Σ>1, DELETE) — isolation par user_id
- Metadata completion : GET completion-status (overall_completion %), GET metadata-form (3 sections pré-remplies), PUT complete
- Admin templates éthiques (verify_admin_role) : GET/PUT/reset/validate ethical-templates (YAML ethical_defaults.yaml, défauts par domaine : default/education/healthcare/social-media/business/finance/technology)
- GET /datasets/{id}/missing-data-analysis
- Code mort : router dataset_metadata_completion.py jamais monté.

## Modèle de données (6 tables)
### datasets
id UUID PK, dataset_name, display_name (NOT NULL indexés), year, objective, access, availability, num_citations (déf 0), citation_link, sources, storage_uri (URL externe), storage_path ;
instances_number, features_description, features_number, domain ARRAY(Text), representativity_description/level, sample_balance_description/level, split Bool, missing_values_description, has_missing_values Bool, global_missing_percentage Float, missing_values_handling_method, temporal_factors Bool, metadata_provided_with_dataset Bool, external_documentation_available Bool, documentation_link, task ARRAY(Text) ;
10 critères éthiques BOOLÉENS TRISTATE (None=non évalué / False / True) : informed_consent, transparency, user_control, equity_non_discrimination, security_measures_in_place, data_quality_documented, anonymization_applied, record_keeping_policy_exists, purpose_limitation_respected, accountability_defined ; data_errors_description ;
created_by UUID nullable (NULL = import Kaggle, admin-only), created_at/updated_at.
Index GIN sur domain et task (opérateurs @> et &&).
### dataset_files
id, dataset_id FK, file_name_in_storage (UUID), original_filename, logical_role (training_data/test_data/data_file), format, mime_type, size_bytes, row_count, description.
### file_columns
id, dataset_file_id FK, column_name, data_type_original (pandas), data_type_interpreted (numerical/categorical/text/datetime/boolean), description, is_primary_key_component, is_nullable, is_pii (JAMAIS calculé côté service, TODO), example_values ARRAY, position, stats JSONB (null_count, null_percentage, unique_count, row_count, min/max/mean/std).
### dataset_relationships + dataset_relationship_column_links : définies, migrées, JAMAIS alimentées/exposées.
### projects
id UUID, user_id (FK logique), name, description, criteria JSONB (format DatasetFilterCriteria), weights JSONB (CriterionWeight[]), created_at/updated_at.

## SCORING (tous scores [0,1])
- Score éthique = (nb critères True) / 10.
- Score technique pondéré normalisé sur poids applicables (None exclus num+dénom) : metadata_provided 0.15 + external_doc 0.15 + missing (0.2 plein si aucun manquant sinon (100-pct)/100×0.2) + split 0.2 + instances 0.15 (log : (log10(n)-2)/3, plein ≥100k) + features 0.15 (optimal 10-100 ; >100 dégressif max(0.5, 1-(f-100)/1000) ; <10 f/10).
- Popularité = min(1, log10(citations)/3) (plein à 1000).
- Score pertinence = Σ(score_critère × poids)/Σ(poids). 12 critères calculables : ethical_score, technical_score, popularity_score/citations, anonymization, transparency, informed_consent, documentation, data_quality, instances_count (log10/5), features_count (f/100), year ((year-2000)/24).
- Poids par défaut si Σ=0 : ethical 0.4 / technical 0.4 / popularity 0.2.
- calculate_criterion_scores : décomposition des 12 sous-scores par dataset = source unique de la heatmap frontend (contrat P2).
- Pondération via Project.weights ou body de POST /datasets/score. PUT projet normalise si Σ>1.

## FILTRAGE (DatasetFilterCriteria, None=ignoré)
- Texte ILIKE : dataset_name, objective.
- ARRAY containment AND : domain @>, task @>.
- Égalité : access, availability.
- Plages : year_min/max, instances_min/max (+alias), features_min/max (+alias), citations_min/max.
- ethical_score_min (0-100) : score éthique recalculé EN SQL inline (duplication).
- Booléens : has_missing_values (True OU False), split/is_split (si True), metadata_provided (si True), external_documentation (si True), temporal_factors (si True), is_anonymized→anonymization_applied, is_public→access=='public'.
- 10 filtres éthiques booléens (filtrent seulement si True ; None/False exclus).
- Tri : dataset_name, year, instances_number, features_number, num_citations, created_at, updated_at (fallback dataset_name).

## Import/ingestion
### Upload manuel : POST /datasets. Conversion CSV/XLSX/JSON/XML→Parquet Snappy, MinIO {dataset_id}/{uuid}.parquet, puis analyse colonnes.
### Pipeline Kaggle (datasets/kaggle-import/, CLI subprocess via auto_init) :
cache 7j → download Kaggle API (unzip, glob CSV) → analyse CSV (types, PII par mots-clés email/phone/name/address/ssn + regex, 3 exemples, stats) → confirmation interactive (bypass --force-refresh) → Parquet Snappy → UUIDs → MinIO datasets/{uuid}/{uuid}.parquet → mapping métadonnées KaggleMetadataMapperV2 (JSON enrichis par dataset enriched_metadata/datasets/*.json validés jsonschema > calculées > techniques ; fallback template par domaine ; tristate) → écriture DB DIRECTE (bypass API) → cache.
- kaggle_datasets_config.yaml : ~35 datasets (éducation majoritaire : student_performance, student_stress, student_depression, riiid, oulad, asap_essay… ; santé : pima_diabetes, breast_cancer, heart_disease ; biologie : iris, mushroom ; finance : bank_marketing ; social : social_media_addiction, titanic ; environnement : penguins).
- AUTO_INIT_DATA=true au startup : si <5 datasets initialisés, lance import (lock file, 7 datasets prioritaires).

## Préview datasets
generate_dataset_preview : fichier Parquet prioritaire, sample 100 lignes (random_state=42), max 20 colonnes, stats par colonne calculées sur dataset COMPLET (type, non_null, unique, mean/std/min/max, top 3 valeurs). Fallback SIMULÉ is_fallback=True si storage inaccessible.

## Logique métier notable
- _analyze_and_save_file_columns : dtype, interprétation (<50% unique = categorical), nulls, 5 exemples, stats ; sanitisation JSONB NaN/Inf ; skip colonnes Unnamed/100% nulles ; instances=max(row_count), features=Σ colonnes ; global_missing_percentage pondérée par lignes ; has_missing_values dérivé.
- quality_metrics : completeness (réel), ethical_compliance (réel), consistency/accuracy/outliers/pii_risk = ALÉATOIRES déterministes (seed MD5 id) flag *_is_simulated.
- distribution_analysis : SIMULÉE (corrélations fictives, patterns manquants, distribution classes).
- similar : même domaine+tâche > domaine > tâche > taille ±50% > récents.
- missing-data-analysis : colonnes techniques exclues par regex, données réelles MinIO (fallback estimé), sévérité low<5/medium<15/high<30/critical≥30, suggestions (MINIMAL_CLEANING/IMPUTE_MEAN/IMPUTE_MODE/CAREFUL_ANALYSIS/CONSIDER_REMOVAL), score=100-moyenne(pct), qualityLevel perfect/good>95/warning>80/critical.
- completion-status : groupes ethical/technical/general, défauts = demi-point, needs_review humain (informed_consent, anonymization, equity).

## Dépendances / env
fastapi 0.115.0, uvicorn 0.30.6, pydantic 2.8.2, sqlalchemy 2.0.34, psycopg2, alembic 1.13.3, minio 7.2.16, azure-storage-blob, pandas 2.2.3, pyarrow 16.1.0, kaggle 1.7.4.5.
ENV : DATABASE_URL, ALLOWED_ORIGINS, STORAGE_TYPE (minio/azure), MINIO_ENDPOINT/ACCESS/SECRET, STORAGE_BUCKET (ibis-x-datasets), AUTO_INIT_DATA, FORCE_INIT_DATA, KAGGLE_USERNAME/KEY.

## Points refonte
1. Monolithe 4105 lignes sans couches.
2. Métriques simulées présentées comme réelles (consistency, accuracy, outliers, pii_risk, distributions).
3. Duplication logique éthique Python vs SQL.
4. PII non fonctionnelle.
5. Router mort.
6. Tables relationships jamais utilisées.
7. Logs debug massifs en prod.
8. Double Base SQLAlchemy.
9. Kaggle bypass API (écriture DB directe).
10. Lecture/preview/download SANS auth ; upload ouvert à tous les authentifiés.
11. Tristate = complexité (filtres ne matchent que True).
