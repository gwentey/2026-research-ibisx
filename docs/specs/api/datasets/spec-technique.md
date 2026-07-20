# Spec Technique — api/datasets

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | api/datasets        |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

---

## Architecture du module

Le module suit un découpage en couches strict :

```
routes.py          → Parsing HTTP, contrôle d'accès, dispatch vers service
service.py         → Logique métier, orchestration profiling + stockage + BDD
profiling.py       → Profiling pandas stateless (types, stats, PII, suggestions)
ethics.py          → Source unique des 10 critères éthiques + calcul du score
filters.py         → Construction des clauses SQL (filtres + tri)
importer.py        → Import YAML/Kaggle via CLI, idempotent
models.py          → Modèles SQLAlchemy (Dataset, DatasetFile, DatasetColumn, EthicalTemplate, QualityAnalysis)
schemas.py         → Schémas Pydantic I/O (StrictModel extra="forbid" sur toutes les entrées)
```

**Flux d'ingestion :** `routes.py::create_dataset` → `service.create_dataset()` → `profiling.read_dataframe()` → `profiling.profile_dataframe()` → `storage.save()` → `db.add(DatasetFile + colonnes)` → `db.commit()`. En cas d'exception, rollback DB + suppression des fichiers partiels dans le stockage.

**Flux de lecture :** `service.to_card()` / `service.to_detail()` appelle `ethics.ethical_score()` à chaque appel (compute-on-read). Le score n'est jamais persisté en colonne dédiée.

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/api/ibis/modules/datasets/routes.py` | Router FastAPI — 17 endpoints, contrôle rôles et ownership | ~241 |
| `apps/api/ibis/modules/datasets/service.py` | Service catalogue — listing, CRUD, aperçu, similaires, ingestion, complétude | ~506 |
| `apps/api/ibis/modules/datasets/profiling.py` | Profiling pandas — parsing, normalisation, types, PII, stats, suggestions | ~285 |
| `apps/api/ibis/modules/datasets/ethics.py` | Source unique des 10 critères éthiques + calcul score ∈ [0,1] | ~28 |
| `apps/api/ibis/modules/datasets/filters.py` | Filtres SQL via SQLAlchemy — 20+ critères + tri stable | ~89 |
| `apps/api/ibis/modules/datasets/importer.py` | Import YAML/Kaggle idempotent — wrapper CLI | ~143 |
| `apps/api/ibis/modules/datasets/models.py` | SQLAlchemy — 5 tables : datasets, dataset_files, dataset_columns, ethical_templates, quality_analyses | ~142 |
| `apps/api/ibis/modules/datasets/schemas.py` | Pydantic I/O — 20+ modèles, StrictModel (extra=forbid) | ~278 |

---

## Schéma BDD

### Table `datasets`

| Colonne | Type SQL | Notes |
|---------|----------|-------|
| `id` | UUID PK | |
| `dataset_name` | VARCHAR(120) UNIQUE INDEX | slug normalisé |
| `display_name` | VARCHAR(255) INDEX | |
| `year` | SMALLINT | |
| `objective` | TEXT | |
| `sources`, `storage_uri`, `documentation_link`, `citation_link` | TEXT / VARCHAR(512) | |
| `num_citations` | INTEGER DEFAULT 0 | |
| `access` | VARCHAR(20) DEFAULT 'public' | `public` ou `private` |
| `availability` | VARCHAR(50) | |
| `metadata_provided_with_dataset`, `external_documentation_available` | BOOLEAN | |
| `instances_number` | BIGINT | calculé à l'ingestion |
| `features_number` | INTEGER | calculé à l'ingestion |
| `features_description` | TEXT | |
| `domain`, `task` | ARRAY(TEXT) | index GIN (ADR-002) |
| `split`, `temporal_factors`, `has_missing_values` | BOOLEAN | |
| `global_missing_percentage` | FLOAT | calculé pondéré à l'ingestion |
| `missing_values_description`, `missing_values_handling_method` | TEXT / VARCHAR(120) | |
| `representativity_level` | VARCHAR(20) | `high` / `medium` / `low` |
| `representativity_description`, `sample_balance_level`, `sample_balance_description` | TEXT / VARCHAR(30) | |
| `informed_consent`, `transparency`, `user_control`, `equity_non_discrimination`, `security_measures_in_place`, `data_quality_documented`, `anonymization_applied`, `record_keeping_policy_exists`, `purpose_limitation_respected`, `accountability_defined` | BOOLEAN (nullable) | 10 critères éthiques tristate |
| `ai_guide` | JSONB | `{text, blocks, model_used, is_fallback, language, tokens_used, generated_at}` — `blocks` est un `BlockDocument` sérialisé (absent sur les guides antérieurs à la v2 ; le front retombe alors sur le rendu Markdown de `text`). Aucune migration SQL : le champ était déjà JSONB libre. |
| `created_by` | UUID FK → users.id ON DELETE SET NULL | NULL = import système |
| `created_at`, `updated_at` | TIMESTAMP | via mixin Timestamped |

### Table `dataset_files`

| Colonne | Type SQL | Notes |
|---------|----------|-------|
| `id` | UUID PK | |
| `dataset_id` | UUID FK → datasets.id ON DELETE CASCADE INDEX | |
| `original_filename` | VARCHAR(255) | nom original conservé |
| `storage_key` | VARCHAR(512) | `datasets/{dataset_id}/{uuid}.parquet` |
| `logical_role` | VARCHAR(20) DEFAULT 'data_file' | auto-détecté : `training_data` si 'train' dans le nom, `test_data` si 'test' |
| `format` | VARCHAR(20) DEFAULT 'parquet' | format canonique post-conversion |
| `size_bytes` | BIGINT DEFAULT 0 | |
| `row_count` | BIGINT DEFAULT 0 | |

### Table `dataset_columns`

| Colonne | Type SQL | Notes |
|---------|----------|-------|
| `id` | UUID PK | |
| `file_id` | UUID FK → dataset_files.id ON DELETE CASCADE INDEX | |
| `name` | VARCHAR(255) | |
| `dtype_original` | VARCHAR(50) | type pandas (`int64`, `object`…) |
| `dtype_interpreted` | VARCHAR(20) | `numerical` / `categorical` / `text` / `datetime` / `boolean` |
| `is_nullable` | BOOLEAN | |
| `is_pii` | BOOLEAN | |
| `example_values` | ARRAY(TEXT) | 5 premières valeurs non-nulles |
| `position` | SMALLINT | |
| `stats` | JSONB | `{null_count, null_percentage, unique_count, row_count, min?, max?, mean?, std?, top_values?}` |

### Table `ethical_templates`

| Colonne | Type SQL | Notes |
|---------|----------|-------|
| `id` | UUID PK | |
| `domain` | VARCHAR(50) UNIQUE | ex. `healthcare`, `default` |
| `defaults` | JSONB | dictionnaire `{critère: bool}` |
| `updated_by` | UUID (nullable) | |

### Table `quality_analyses`

| Colonne | Type SQL | Notes |
|---------|----------|-------|
| `id` | UUID PK | |
| `dataset_id` | UUID FK → datasets.id ON DELETE CASCADE UNIQUE | |
| `analysis`, `column_recommendations` | JSONB | |
| `quality_score` | SMALLINT | |
| `computed_at`, `expires_at` | TIMESTAMP | cache 7 jours (CDC §8.2) |

---

## API / Endpoints

| Méthode | Route | operation_id | Description | Auth min. |
|---------|-------|-------------|-------------|-----------|
| GET | `/datasets` | listDatasets | Catalogue paginé avec filtres (20+ critères) | user |
| GET | `/datasets/facets` | getDatasetFacets | Valeurs facettes + bornes numériques | user |
| GET | `/datasets/stats` | getCatalogStats | KPI catalogue (total datasets, instances, distribution) | user |
| POST | `/datasets/preview` | analyzeUpload | Analyse pré-upload stateless (profil, suggestions) | contributor |
| POST | `/datasets` | createDataset | Création multipart (fichiers + metadata JSON) | contributor |
| GET | `/datasets/{id}` | getDataset | Détail complet + colonnes + score éthique | user |
| PUT | `/datasets/{id}` | updateDataset | Mise à jour métadonnées (owner ou admin) | user (owner/admin) |
| DELETE | `/datasets/{id}` | deleteDataset | Suppression dataset + fichiers stockage | user (owner/admin) |
| GET | `/datasets/{id}/preview` | previewDataset | Aperçu 50 lignes réelles (random_state=42) | user |
| GET | `/datasets/{id}/similar` | getSimilarDatasets | Top 5 similaires par domaine/tâche/taille | user |
| GET | `/datasets/{id}/files` | listDatasetFiles | Liste des fichiers (sans colonnes) | user |
| GET | `/datasets/{id}/files/{file_id}/download` | downloadDatasetFile | Streaming authentifié Parquet | user |
| GET | `/datasets/{id}/completion` | getDatasetCompletion | % de complétion par section | user |
| POST | `/datasets/{id}/ai-guide` | requestAiGuide | Lancement async guide LLM (retourne job_id, HTTP 202) | user |

**Note :** les routes statiques (`/facets`, `/stats`, `/preview`, POST root) sont déclarées AVANT `/{dataset_id}` dans le router pour éviter les ambiguïtés de matching FastAPI.

---

## Patterns identifiés

- **Service layer** — toute la logique métier est dans `service.py`. Les routes ne font que parser, valider et dispatcher.
- **Porte d'entrée unique** — `service.create_dataset()` est le seul point d'écriture de dataset en base. `importer.py` (seed YAML/Kaggle) passe par ce même service. Commentaire explicit `[NE PAS REPRODUIRE]` pour l'écriture SQL directe héritée de la v1.
- **Compute-on-read pour le score éthique** — `ethical_score()` est appelé dans chaque `to_card()` et `to_detail()` ; le score n'est pas persisté. Le filtre SQL `ethical_score_min` réexprime le calcul en SQL côté `filters.py` (même source `ETHICAL_CRITERIA`).
- **Format Parquet canonique** — tout fichier entrant (CSV/XLSX/JSON/Parquet) est converti en Parquet+Snappy à l'ingestion (ADR-005). Le format original est conservé dans `original_filename` uniquement.
- **Rollback défensif** — `create_dataset()` utilise `try/except` avec rollback BDD + suppression des clés de stockage en cas d'erreur partielle.
- **Sanitizer JSONB unique** — `profiling.sanitize_json()` normalise NaN/Inf → None et scalaires numpy → natifs (ADR-002). Appelé sur toutes les stats et les aperçus.
- **random_state=42 persistent** — aperçu `preview_dataset()` et sort secondaire stable `Dataset.id.asc()` dans `filters.py` pour pagination déterministe (P4, ADR-006).
- **StrictModel (extra="forbid")** — tous les payloads d'entrée utilisent `StrictModel` (héritage de `BaseModel` avec `ConfigDict(extra="forbid")`). Les schémas de lecture utilisent `from_attributes=True`.
- **Normalisation des faux manquants** — `normalize_dataframe()` utilise `MISSING_VALUE_TOKENS` depuis `ml/vocab.py` (source unique) pour remplacer les strings vides-variantes par `None`.

---

## Algorithmes et heuristiques (spec-technique uniquement, pas ADR)

### Interprétation des types pandas (`profiling.interpret_dtype`)
1. `is_bool_dtype` → `boolean`
2. `is_datetime64_any_dtype` → `datetime`
3. `is_numeric_dtype` → `numerical`
4. Sinon, texte : si ≤ 2 valeurs uniques dans `{true/false/yes/no/0/1/oui/non}` → `boolean`
5. Si `unique_count ≤ 50` ET `unique_count / non_null_count ≤ 0.5` → `categorical`
6. Sinon → `text`

### Détection PII (`profiling.detect_pii`)
- Niveau 1 : nom de colonne contient un keyword de la liste (`email`, `phone`, `name`, `ssn`, `iban`…)
- Niveau 2 : >50 % des 50 premières valeurs matchent le pattern email regex

### Suggestions de domaine (`profiling.suggest_domains`)
- Score par domaine = nombre de keywords du domaine présents dans l'ensemble des noms de colonnes (lowercase)
- Top 3 domaines avec score > 0

### Suggestions de tâches (`profiling.suggest_tasks`)
- `categorical` ou `boolean` → `classification`
- `numerical` → `regression`
- `datetime` → `time_series`
- `text` → `nlp`
- Défaut si aucun type : `classification`

### Score qualité indicatif (`profiling.indicative_quality_score`)
- `score = 100 - min(50, missing_percentage * 2)`
- ∈ [50, 100]

### Datasets similaires (`service.similar_datasets`)
- Priorité : (0) même domaine ET tâche → (1) même domaine → (2) même tâche → (3) taille ±50 %
- Tri secondaire : citations décroissantes
- Retourne les 5 premiers

### Templates éthiques par domaine (`service.template_defaults_for_domains`)
- Itère sur `[*domains, "default"]`
- Retourne les defaults du premier template matching en base
- N'écrase que les champs `None` dans le payload

### Complétude (`service.completion_status`)
- 3 sections : `general` (8 champs), `technical` (12 champs), `ethical` (10 critères)
- `filled` = champs non-None et non-vides
- 3 champs `NEEDS_HUMAN_REVIEW` signalés séparément : `informed_consent`, `anonymization_applied`, `equity_non_discrimination`

---

## Configuration

| Variable d'env | Usage | Défaut |
|----------------|-------|--------|
| `UPLOAD_MAX_BYTES` | Taille maximale d'un fichier uploadé | configurable via Settings |
| `STORAGE_BACKEND` | `local` ou `s3` | `local` |
| `DATA_DIR` | Répertoire racine du stockage local | `/data` |
| `KAGGLE_USERNAME` / `KAGGLE_KEY` | Import Kaggle via CLI officielle | absents en dev |

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/api/tests/integration/test_datasets.py` | Endpoints CRUD, upload, preview, filtres, similaires, completion ; `test_guide_fallback_is_honest` mis à jour (titres du miroir texte passent de `##` à `###`) | Existant (~335 lignes) |
| `apps/api/tests/unit/test_profiling.py` | `read_dataframe`, `profile_dataframe`, `sanitize_json`, suggestions | Existant (~89 lignes) |
| Tests `ethics.py` | Calcul `ethical_score()` | Absent (couverture manquante) |
| Tests `importer.py` | Import YAML/Kaggle | Absent (couverture manquante) |
| Tests `filters.py` | Filtres SQL combinés | Absent (couverture manquante) |
