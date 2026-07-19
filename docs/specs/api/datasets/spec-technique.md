# Spec Technique — api/datasets

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | api/datasets        |
| Version       | 0.2.0               |
| Date          | 2026-07-20          |
| Source        | Rétro-ingénierie + import Kaggle (session 20/07/2026) |

---

## Architecture du module

Le module suit un découpage en couches strict :

```
routes.py          → Parsing HTTP, contrôle d'accès, dispatch vers service
service.py         → Logique métier, orchestration profiling + stockage + BDD
profiling.py       → Profiling pandas stateless (types, stats, PII, suggestions)
ethics.py          → Source unique des 10 critères éthiques + calcul du score
filters.py         → Construction des clauses SQL (filtres + tri)
importer.py        → Import YAML idempotent (seed)
kaggle_client.py   → Client httpx Kaggle API (parse URL, meta, download, zip-slip guard)
kaggle_import.py   → Orchestration import communautaire (prepare synchrone + run_import worker)
enrichment.py      → Enrichissement déterministe (tags → domaines, profiling → tâche) + couche LLM optionnelle
models.py          → Modèles SQLAlchemy (Dataset, DatasetFile, DatasetColumn, EthicalTemplate, QualityAnalysis)
schemas.py         → Schémas Pydantic I/O (StrictModel extra="forbid" sur toutes les entrées)
```

**Flux d'ingestion :** `routes.py::create_dataset` → `service.create_dataset()` → `profiling.read_dataframe()` → `profiling.profile_dataframe()` → `storage.save()` → `db.add(DatasetFile + colonnes)` → `db.commit()`. En cas d'exception, rollback DB + suppression des fichiers partiels dans le stockage.

**Flux de lecture :** `service.to_card()` / `service.to_detail()` appelle `ethics.ethical_score()` à chaque appel (compute-on-read). Le score n'est jamais persisté en colonne dédiée.

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/api/ibis/modules/datasets/routes.py` | Router FastAPI — 19 endpoints, contrôle rôles et ownership | ~317 |
| `apps/api/ibis/modules/datasets/service.py` | Service catalogue — listing, CRUD, aperçu, similaires, ingestion, complétude, revue éthique | ~530 |
| `apps/api/ibis/modules/datasets/profiling.py` | Profiling pandas — parsing, normalisation, types, PII, stats, suggestions | ~285 |
| `apps/api/ibis/modules/datasets/ethics.py` | Source unique des 10 critères éthiques + calcul score ∈ [0,1] | ~28 |
| `apps/api/ibis/modules/datasets/filters.py` | Filtres SQL via SQLAlchemy — 20+ critères + tri stable | ~89 |
| `apps/api/ibis/modules/datasets/importer.py` | Import YAML idempotent — seed uniquement (Kaggle → kaggle_import.py) | ~143 |
| `apps/api/ibis/modules/datasets/kaggle_client.py` | Client httpx Kaggle API — parse URL multi-formes, métadonnées, licence, téléchargement plafonné, zip-slip guard | ~308 |
| `apps/api/ibis/modules/datasets/kaggle_import.py` | Orchestration import communautaire — `prepare()` synchrone + `run_import()` worker, dédup, slug unique | ~152 |
| `apps/api/ibis/modules/datasets/enrichment.py` | Enrichissement déterministe (tags Kaggle → domaines, profilage → tâche) + couche LLM optionnelle (objectif FR) | ~262 |
| `apps/api/ibis/modules/datasets/models.py` | SQLAlchemy — 5 tables : datasets (+7 colonnes), dataset_files, dataset_columns, ethical_templates, quality_analyses | ~172 |
| `apps/api/ibis/modules/datasets/schemas.py` | Pydantic I/O — 24+ modèles, StrictModel (extra=forbid) | ~339 |
| `apps/api/ibis/workers/tasks/kaggle.py` | Tâche Celery `import_kaggle_dataset` — file `maintenance`, gestion états job | ~88 |

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
| `source_kind` | VARCHAR(20) DEFAULT 'upload' | `upload` / `kaggle` / `seed` — provenance de l'entrée |
| `source_ref` | VARCHAR(160) NULL | clé de déduplication (`kaggle:owner/slug`) — NULL pour les uploads directs |
| `license_name` | VARCHAR(160) NULL | licence déclarée par Kaggle (ex. `CC0: Public Domain`) |
| `is_verified` | BOOLEAN DEFAULT false | badge « Vérifié IBIS-X » explicite, non déduit de `created_by IS NULL` |
| `ethics_suggestions` | JSONB NULL | propositions LLM (`{critère: bool, justification: str}`) — jamais dans `ethical_score` |
| `ethics_reviewed_at` | TIMESTAMP NULL | horodatage de la dernière revue humaine des critères éthiques |
| `ethics_reviewed_by` | UUID FK → users.id ON DELETE SET NULL | réviseur éthique (NULL si pas encore révisé) |
| `ai_guide` | JSONB | `{text, model_used, is_fallback, language, generated_at}` |
| `created_by` | UUID FK → users.id ON DELETE SET NULL | NULL = import système / seed |
| `created_at`, `updated_at` | TIMESTAMP | via mixin Timestamped |

**Relation ORM ajoutée :** `owner` — eager-loaded (`lazy="selectin"`) depuis `created_by → users`, expose `DatasetOwner` dans les schémas de lecture.

**Index ajoutés (migration 0010) :**

| Index | Type | Colonnes / Condition | Rôle |
|-------|------|----------------------|------|
| `ix_datasets_source_ref` | simple | `source_ref` | recherche rapide par référence |
| `uq_datasets_source_ref_public` | UNIQUE PARTIAL | `source_ref WHERE access = 'public'` | catalogue public sans doublon, copies privées permises |
| `ix_datasets_is_verified` | simple | `is_verified` | filtre badge sur le catalogue |
| FK `fk_datasets_ethics_reviewed_by_users` | — | `ethics_reviewed_by → users.id ON DELETE SET NULL` | traçabilité revue éthique |

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
| POST | `/datasets/import/kaggle` | importKaggleDataset | Import communautaire par URL Kaggle (validation synchrone + job async) | **user** (tout compte connecté) |
| POST | `/datasets/{id}/ethics-review` | reviewDatasetEthics | Revue partielle des critères éthiques (propriétaire ou admin) | user (owner/admin) |

**Note :** les routes statiques (`/facets`, `/stats`, `/preview`, POST root, `/import/kaggle`) sont déclarées AVANT `/{dataset_id}` dans le router pour éviter les ambiguïtés de matching FastAPI.

**RBAC — asymétrie délibérée :** `POST /datasets/import/kaggle` est ouvert à tout compte connecté (role `user`), contrairement à `POST /datasets` (upload libre, réservé `contributor+`). L'import est plus contraint : source publique identifiée, licence vérifiée, taille plafonnée, doublons écartés, attribution nominative, aucun octet arbitraire déposé. La garde sociale est l'attribution visible, pas le rôle. Limiteur : `rate_limit("kaggle_import", times=10, seconds=3600)` (10 imports/heure par IP).

---

## Patterns identifiés

**Schémas ajoutés (session 20/07/2026) :**

| Schéma | Sens | Description |
|--------|------|-------------|
| `DatasetOwner` | sortie | `{id, pseudo, avatar_url}` — importeur affiché sur les cartes |
| `KaggleImportRequest` | entrée | URL Kaggle + visibility optionnelle |
| `KaggleImportResponse` | sortie | `{job_id, message}` — HTTP 202 |
| `EthicsReviewInput` | entrée | `{critère: bool}` — field_validator rejette tout critère hors ETHICAL_CRITERIA (422) |

`DatasetCard` gagne : `owner`, `is_verified`, `source_kind`, `license_name`.
`DatasetDetail` gagne : `ethics_suggestions`, `ethics_reviewed_at`, `source_ref`.

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
- **Import Kaggle en deux temps** — `kaggle_import.prepare()` valide l'URL, vérifie la licence, contrôle le plafond de taille (`totalBytes`), et détecte le doublon de manière synchrone (réponse immédiate en cas d'erreur). `run_import()` est la phase asynchrone (worker Celery, file `maintenance`) : téléchargement, décompression, re-vérification taille décompressée, profiling, enrichissement, write BDD. La séparation synchrone/asynchrone garantit qu'une URL invalide n'enfile jamais le worker.
- **Enrichissement LLM optionnel avec repli silencieux** — `enrichment.py` génère l'objectif en français via LLM si `OPENROUTER_API_KEY` est fournie. Toute erreur LLM (timeout, JSON malformé, hors-format) est capturée, l'import aboutit quand même avec un enrichissement purement déterministe.
- **Invariant éthique « l'IA propose, l'humain assume »** — les propositions LLM (`ethics_suggestions`) sont stockées dans une colonne JSONB séparée des 10 critères éthiques. `ethical_score()` (dans `ethics.py`) ne lit que les 10 colonnes booléennes tristate, jamais `ethics_suggestions`. Le seul chemin pour qu'une suggestion devienne un critère évalué est `POST /datasets/{id}/ethics-review`, déclenché par un humain. Ce pattern est un invariant transverse (api/datasets, api/scoring, web/datasets) — voir suggestion ADR en fin de document.
- **Revue éthique partielle** — `service.review_ethics()` ne touche que les critères présents dans le payload. Un critère absent n'est pas remis à NULL. Une revue peut s'effectuer en plusieurs fois sans effacer le travail précédent.
- **is_verified explicite** — `is_verified` est une colonne boolean propre, non déduite de `created_by IS NULL`. La suppression d'un compte positionne `created_by` à NULL (ON DELETE SET NULL) sans promouvoir l'import en « Vérifié IBIS-X ». La migration 0010 positionne `is_verified = true` sur tous les datasets existants (catalogue curé).
- **Client Kaggle httpx, pas CLI** — `kaggle_client.py` utilise `httpx` directement contre l'API REST Kaggle (pas la CLI `kaggle`, non installée). Auth Bearer (`KAGGLE_API_TOKEN`) en priorité, repli Basic legacy (`KAGGLE_USERNAME`/`KAGGLE_KEY`). La taille est lue sur `totalBytes` avant téléchargement puis sur la taille décompressée après extraction. Les chemins d'archive contenant `../` sont rejetés (zip slip).

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
| `KAGGLE_API_TOKEN` | Auth Bearer API Kaggle (prioritaire) | absent en dev |
| `KAGGLE_USERNAME` / `KAGGLE_KEY` | Auth Basic legacy Kaggle (repli si pas de token) | absents en dev |
| `KAGGLE_MAX_DATASET_MB` | Plafond taille dataset Kaggle (totalBytes + taille décompressée) | 200 Mo |

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/api/tests/integration/test_datasets.py` | Endpoints CRUD, upload, preview, filtres, similaires, completion | Existant (~335 lignes) |
| `apps/api/tests/unit/test_profiling.py` | `read_dataframe`, `profile_dataframe`, `sanitize_json`, suggestions | Existant (~89 lignes) |
| `apps/api/tests/unit/test_kaggle_client.py` | `parse_kaggle_url` (toutes formes), `license_allows_redistribution`, zip-slip | Ajouté (~249 lignes) |
| `apps/api/tests/unit/test_dataset_enrichment.py` | Enrichissement déterministe tags→domaines, repli LLM, invariants ETHICAL_CRITERIA | Ajouté (~256 lignes) |
| `apps/api/tests/integration/test_kaggle_import.py` | Import complet mocké (httpx), déduplication, plafond taille, licence refusée, revue éthique | Ajouté (~297 lignes) |
| `apps/api/tests/integration/test_ethics_review.py` | `POST /datasets/{id}/ethics-review` : revue partielle, rejet critère inconnu, droits owner/admin | Ajouté (~196 lignes) |
| Tests `ethics.py` | Calcul `ethical_score()` | Absent (couverture manquante) |
| Tests `filters.py` | Filtres SQL combinés | Absent (couverture manquante) |

---

## Suggestion ADR (update-writer-after-implement, 2026-07-20)

> **ADR suggere :** « Invariant ethique — les propositions IA ne comptent jamais dans le score ethique avant validation humaine » — Categorie : DATA-MODEL

Justification (a inclure dans l'ADR avant la section ## Contexte) :

| Champ | Valeur |
|-------|--------|
| Categorie | DATA-MODEL |
| Q1 — Cout de revert > 1j ? | OUI — modifier l'invariant exige de refondre `ethics.py` (ethical_score), `service.review_ethics()`, les schemas DatasetDetail/EthicsReviewInput, les 4 composants frontend ethique et les tests d'integration — refactoring transverse multi-jours |
| Q2 — Non-deductible du code ? | OUI — on peut lire que `ethical_score()` n'utilise pas `ethics_suggestions`, mais le POURQUOI (responsabilite humaine sur les jugements ethiques, l'IA ne statut jamais seule) n'est pas dans le code |
| Q3 — Impact >= 2 specs ? | OUI — api/datasets (stockage + route review), api/scoring (ethical_score ne doit jamais lire ethics_suggestions), web/datasets (dialog + banner + ethics-review.ts) |
| Q4 — Casse un invariant si ignore ? | OUI — un dev ajoutant une auto-application des suggestions (confidence > seuil => critere vrai) casserait l'invariant fondateur : le catalogue exposerait des labels ethiques jamais valides par un humain |

> Le dev decidera s'il faut rediger l'ADR. Si oui, copier ce bloc justification dans le fichier ADR cree.

**Candidat 2 rejete — unicite partielle `UNIQUE (source_ref) WHERE access='public'` :** AP-7 (detail de schema BDD non-architectural). La regle semantique est documentee dans les patterns ci-dessus et dans le CHANGELOG. L'index est lisible directement dans la migration commentee.
