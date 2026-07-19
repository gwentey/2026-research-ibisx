# Schéma BDD — IBIS-X

> Dernière mise à jour : 2026-07-20 (migration 0010 — import communautaire Kaggle)
> Source de vérité : `apps/api/alembic/versions/`
> ORM : SQLAlchemy 2.0 + Alembic (auto-apply au démarrage)
> BDD : PostgreSQL 16

---

## Table `datasets`

| Colonne | Type SQL | Nullable | Défaut | Notes |
|---------|----------|----------|--------|-------|
| `id` | UUID | NOT NULL | gen_random_uuid() | PK |
| `dataset_name` | VARCHAR(120) | NOT NULL | — | slug normalisé, UNIQUE INDEX |
| `display_name` | VARCHAR(255) | NOT NULL | — | INDEX |
| `year` | SMALLINT | NULL | — | |
| `objective` | TEXT | NULL | — | |
| `sources` | TEXT | NULL | — | |
| `storage_uri` | TEXT | NULL | — | |
| `documentation_link` | VARCHAR(512) | NULL | — | |
| `citation_link` | VARCHAR(512) | NULL | — | |
| `num_citations` | INTEGER | NOT NULL | 0 | |
| `access` | VARCHAR(20) | NOT NULL | 'public' | `public` ou `private` |
| `availability` | VARCHAR(50) | NULL | — | |
| `metadata_provided_with_dataset` | BOOLEAN | NULL | — | |
| `external_documentation_available` | BOOLEAN | NULL | — | |
| `instances_number` | BIGINT | NULL | — | calculé à l'ingestion |
| `features_number` | INTEGER | NULL | — | calculé à l'ingestion |
| `features_description` | TEXT | NULL | — | |
| `domain` | ARRAY(TEXT) | NULL | — | INDEX GIN |
| `task` | ARRAY(TEXT) | NULL | — | INDEX GIN |
| `split` | BOOLEAN | NULL | — | |
| `temporal_factors` | BOOLEAN | NULL | — | |
| `has_missing_values` | BOOLEAN | NULL | — | |
| `global_missing_percentage` | FLOAT | NULL | — | calculé pondéré |
| `missing_values_description` | TEXT | NULL | — | |
| `missing_values_handling_method` | VARCHAR(120) | NULL | — | |
| `representativity_level` | VARCHAR(20) | NULL | — | `high` / `medium` / `low` |
| `representativity_description` | TEXT | NULL | — | |
| `sample_balance_level` | VARCHAR(30) | NULL | — | |
| `sample_balance_description` | TEXT | NULL | — | |
| `informed_consent` | BOOLEAN | NULL | — | critère éthique tristate |
| `transparency` | BOOLEAN | NULL | — | critère éthique tristate |
| `user_control` | BOOLEAN | NULL | — | critère éthique tristate |
| `equity_non_discrimination` | BOOLEAN | NULL | — | critère éthique tristate |
| `security_measures_in_place` | BOOLEAN | NULL | — | critère éthique tristate |
| `data_quality_documented` | BOOLEAN | NULL | — | critère éthique tristate |
| `anonymization_applied` | BOOLEAN | NULL | — | critère éthique tristate |
| `record_keeping_policy_exists` | BOOLEAN | NULL | — | critère éthique tristate |
| `purpose_limitation_respected` | BOOLEAN | NULL | — | critère éthique tristate |
| `accountability_defined` | BOOLEAN | NULL | — | critère éthique tristate |
| `ai_guide` | JSONB | NULL | — | `{text, model_used, is_fallback, language, generated_at}` |
| `source_kind` | VARCHAR(20) | NOT NULL | 'upload' | `upload` / `kaggle` / `seed` — migration 0010 |
| `source_ref` | VARCHAR(160) | NULL | — | clé de dédup (`kaggle:owner/slug`) — migration 0010 |
| `license_name` | VARCHAR(160) | NULL | — | licence Kaggle — migration 0010 |
| `is_verified` | BOOLEAN | NOT NULL | false | badge Vérifié IBIS-X, non déduit de created_by — migration 0010 |
| `ethics_suggestions` | JSONB | NULL | — | propositions LLM, jamais dans ethical_score — migration 0010 |
| `ethics_reviewed_at` | TIMESTAMP | NULL | — | horodatage dernière revue humaine — migration 0010 |
| `ethics_reviewed_by` | UUID | NULL | — | FK → users.id ON DELETE SET NULL — migration 0010 |
| `created_by` | UUID | NULL | — | FK → users.id ON DELETE SET NULL |
| `created_at` | TIMESTAMP | NOT NULL | now() | via mixin Timestamped |
| `updated_at` | TIMESTAMP | NOT NULL | now() | via mixin Timestamped |

### Index `datasets`

| Nom | Type | Colonnes / Condition |
|-----|------|----------------------|
| `pk_datasets` | PRIMARY KEY | `id` |
| `uq_datasets_dataset_name` | UNIQUE | `dataset_name` |
| `ix_datasets_display_name` | INDEX | `display_name` |
| `ix_datasets_domain` | GIN | `domain` |
| `ix_datasets_task` | GIN | `task` |
| `ix_datasets_source_ref` | INDEX | `source_ref` |
| `uq_datasets_source_ref_public` | UNIQUE PARTIAL | `source_ref WHERE access = 'public'` |
| `ix_datasets_is_verified` | INDEX | `is_verified` |
| `fk_datasets_created_by_users` | FK | `created_by → users.id ON DELETE SET NULL` |
| `fk_datasets_ethics_reviewed_by_users` | FK | `ethics_reviewed_by → users.id ON DELETE SET NULL` |

> **Invariant** : `ethics_suggestions` ne contribue jamais à `ethical_score`. Le score est calculé compute-on-read depuis les 10 colonnes booléennes tristate uniquement. La seule voie pour qu'une suggestion devienne un critère évalué est `POST /datasets/{id}/ethics-review` (validation humaine).

---

## Table `dataset_files`

| Colonne | Type SQL | Notes |
|---------|----------|-------|
| `id` | UUID PK | |
| `dataset_id` | UUID FK → datasets.id ON DELETE CASCADE INDEX | |
| `original_filename` | VARCHAR(255) | nom original conservé |
| `storage_key` | VARCHAR(512) | `datasets/{dataset_id}/{uuid}.parquet` |
| `logical_role` | VARCHAR(20) DEFAULT 'data_file' | auto-détecté : `training_data` / `test_data` / `data_file` |
| `format` | VARCHAR(20) DEFAULT 'parquet' | format canonique post-conversion |
| `size_bytes` | BIGINT DEFAULT 0 | |
| `row_count` | BIGINT DEFAULT 0 | |

---

## Table `dataset_columns`

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

---

## Table `ethical_templates`

| Colonne | Type SQL | Notes |
|---------|----------|-------|
| `id` | UUID PK | |
| `domain` | VARCHAR(50) UNIQUE | ex. `healthcare`, `default` |
| `defaults` | JSONB | dictionnaire `{critère: bool}` |
| `updated_by` | UUID (nullable) | |

---

## Table `quality_analyses`

| Colonne | Type SQL | Notes |
|---------|----------|-------|
| `id` | UUID PK | |
| `dataset_id` | UUID FK → datasets.id ON DELETE CASCADE UNIQUE | |
| `analysis`, `column_recommendations` | JSONB | |
| `quality_score` | SMALLINT | |
| `computed_at`, `expires_at` | TIMESTAMP | cache 7 jours (CDC §8.2) |

---

## Historique des migrations

| Révision | Résumé |
|----------|--------|
| 0001 | Création initiale (users, datasets, fichiers, colonnes) |
| … | … |
| 0008 | (Dernière avant cette branche) |
| 0010 | Import communautaire Kaggle — 7 colonnes + 3 index + 1 FK sur `datasets`, seed marqué `is_verified = true` |

> La révision 0009 est réservée par une branche concurrente (`explanation_blocks`, absente de main). La migration 0010 a `down_revision = "0008"` pour éviter deux têtes Alembic à la fusion.
