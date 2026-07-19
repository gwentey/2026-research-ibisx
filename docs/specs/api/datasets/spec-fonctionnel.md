# Spec Fonctionnelle — api/datasets [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | api/datasets        |
| Version    | 0.1.0               |
| Date       | 2026-07-19          |
| Auteur     | retro-documenter    |
| Statut     | DRAFT               |
| Source     | Rétro-ingénierie    |

> **[DRAFT — à valider par le dev]** Cette spec a été générée par rétro-ingénierie
> à partir du code existant. Elle doit être relue et validée par un développeur
> qui connaît le contexte métier.

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [RETRO-003](../../../adr/RETRO-003.md) | Taxonomie Khelifi 2024 : 10 critères éthiques tristate | Documenté (rétro) |
| [RETRO-004](../../../adr/RETRO-004.md) | Score éthique compute-on-read : jamais persisté en colonne dédiée | Documenté (rétro) |
| [RETRO-005](../../../adr/RETRO-005.md) | Scores de pertinence calculés à la demande (raw + compute-on-read) — non matérialisés en base | Documenté (rétro) |
| [RETRO-011](../../../adr/RETRO-011.md) | Vocabulaire canonique unique de nettoyage (vocab.py) | Documenté (rétro) |
| [RETRO-015](../../../adr/RETRO-015.md) | Templates ethiques stockes en base (source autoritaire) | Documente (retro) |
| [RETRO-018](../../../adr/RETRO-018.md) | Taxonomie éthique des datasets : 10 critères Khelifi 2024 | Documenté (rétro) |
| [RETRO-019](../../../adr/RETRO-019.md) | Téléchargement authentifié via API : jamais d'URL de stockage directe | Documenté (rétro) |

> *Table auto-générée par adr-linker. Ne pas éditer manuellement.*

---

## Contexte et objectif

Le module `api/datasets` est le catalogue central de datasets d'IBIS-X. Il gère le cycle de vie complet d'un dataset : import (upload multipart ou seed YAML/Kaggle), profiling automatique à l'ingestion, scoring éthique sur 10 critères, filtrage multi-facettes, aperçu réel et génération asynchrone d'un guide IA par LLM. Il constitue le point d'entrée de la plateforme : un dataset doit exister avant qu'une expérience ML puisse être créée.

---

## Règles métier (déduites du code)

1. **Un slug unique identifie chaque dataset.** Le champ `dataset_name` est un slug ASCII normalisé (max 120 car.), unique en base. Une tentative de création avec un slug existant retourne une erreur 409.

2. **Au moins un fichier de données est obligatoire à la création.** Toute tentative de `create_dataset` sans fichier lève `InvalidInputError`.

3. **Limite d'upload : 10 fichiers, taille contrôlée par `UPLOAD_MAX_BYTES`.** Au-delà de 10 fichiers ou au-delà de la taille max configurée, la requête est rejetée avant toute persistance.

4. **Seuls les formats CSV, XLSX, JSON et Parquet sont acceptés.** Tout autre format lève une erreur explicite `UNSUPPORTED_FORMAT`. XLS est redirigé vers xlsx.

5. **L'analyse pré-upload est stateless (aucune persistance).** `POST /datasets/preview` analyse les fichiers et retourne suggestions + aperçu sans écrire en base ni en stockage.

6. **Le score éthique est un nombre ∈ [0,1] par pas de 10 %.** Il est calculé à la lecture (compute-on-read) en comptant les critères à `True` parmi 10. `None` (non évalué) et `False` comptent 0.

7. **Les critères éthiques sont en tristate : `None` / `False` / `True`.** `None` signifie « non évalué » — différent de `False` (évalué, absent). Cette distinction est visible dans la réponse API (`ethical_criteria` dans `DatasetDetail`).

8. **Les templates éthiques par domaine pré-remplissent les critères à la création.** Le premier domaine matching dans la table `ethical_templates` est appliqué ; les valeurs déjà saisies par l'utilisateur ne sont pas écrasées.

9. **L'aperçu est un échantillon réel de 50 lignes (random_state=42).** Il n'est jamais simulé. Si le fichier est indisponible dans le stockage, l'erreur est explicite (`DATASET_FILE_UNAVAILABLE`).

10. **Les datasets similaires sont cherchés par priorité : même domaine ET tâche > même domaine > même tâche > taille ±50 %.** Les ex-æquo sont triés par nombre de citations décroissant.

11. **La création est atomique avec nettoyage en cas d'erreur.** Si l'ingestion d'un fichier échoue après que des fichiers précédents ont été écrits dans le stockage, tous les fichiers partiellement stockés sont supprimés et la transaction est annulée.

12. **Les fichiers stockés ne sont jamais servis directement** — uniquement via l'endpoint authentifié `GET /datasets/{id}/files/{file_id}/download` en streaming. La clé de stockage est un UUID opaque.

13. **Le guide IA est généré de façon asynchrone.** `POST /datasets/{id}/ai-guide` crée un job Celery sur la queue `llm` et retourne un `job_id` (HTTP 202). La sortie est balisée `model_used` / `is_fallback` pour traçabilité.

14. **Seul le propriétaire ou un administrateur peut modifier ou supprimer un dataset.** La route `PUT` et `DELETE` vérifient `require_owner_or_admin`.

15. **La création de dataset est réservée aux contributeurs et administrateurs** (rôle `contributor` minimum).

16. **L'import via YAML (seed) est idempotent.** Un slug déjà présent en base est ignoré sauf si `force=True`. L'import `local_only` n'utilise que les fichiers embarqués (pas de clé Kaggle requise).

17. **Les agrégats techniques (instances_number, features_number, global_missing_percentage) sont calculés à l'ingestion**, pondérés par le nombre de lignes par fichier pour le taux de manquants.

---

## Cas d'usage (déduits)

### CU-001 — Analyse pré-upload
Un contributeur soumet ses fichiers à `POST /datasets/preview` pour obtenir le profil (types, PII, manquants, aperçu 10 lignes), un nom suggéré, des domaines/tâches suggérés et un score qualité indicatif — sans rien persister.

### CU-002 — Création d'un dataset
Le contributeur envoie ses fichiers + métadonnées JSON à `POST /datasets`. Le système : parse les métadonnées (extra=forbid), lit et profile chaque fichier, convertit en Parquet+Snappy, persiste les fichiers et colonnes en base, applique le template éthique du domaine, calcule les agrégats.

### CU-003 — Consultation du catalogue avec filtres
Un utilisateur authentifié navigue via `GET /datasets` avec des filtres combinés (recherche textuelle, domaines, tâches, plages numériques, critères éthiques individuels, score éthique minimum). Les filtres sont tous appliqués côté backend en SQL.

### CU-004 — Aperçu d'un dataset
Un utilisateur consulte `GET /datasets/{id}/preview` pour visualiser 50 lignes réelles (random_state=42) du premier fichier, avec filtrage optionnel de colonnes (max 20 affichées).

### CU-005 — Génération du guide IA
Un utilisateur déclenche `POST /datasets/{id}/ai-guide?language=fr`. Un job Celery est soumis sur la queue `llm`. L'utilisateur suit l'avancement via le module jobs. Le résultat final est stocké dans `datasets.ai_guide` (JSONB).

### CU-006 — Import YAML (seed)
L'administrateur exécute l'importer CLI avec un fichier `datasets.yaml`. Chaque entrée est traitée en passant par `service.create_dataset()` — même pipeline que l'upload. Les slugs déjà présents sont ignorés (idempotence).

### CU-007 — Complétion du profil
Un contributeur consulte `GET /datasets/{id}/completion` pour voir le pourcentage de remplissage (général / technique / éthique) et les champs manquants, dont les 3 champs nécessitant validation humaine (`informed_consent`, `anonymization_applied`, `equity_non_discrimination`).

---

## Dépendances

- `ibis.modules.auth.deps` — contrôle d'accès (rôles, ownership)
- `ibis.modules.jobs.service` — création du job guide IA
- `ibis.workers.tasks.guide` — tâche Celery de génération du guide
- `ibis.storage` — abstraction LocalFS / S3 (ADR-005)
- `ibis.modules.ml.vocab` — tokens de valeurs manquantes (normalisation)
- `ibis.modules.datasets.ethics` — source unique des 10 critères éthiques
- `ibis.core.config` — settings (UPLOAD_MAX_BYTES, STORAGE_BACKEND, KAGGLE_*)

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Taxonomie Khelifi 2024** — l'origine académique des 10 critères est mentionnée en commentaire mais ni la référence complète ni l'éventuelle adaptation faite pour IBIS-X ne sont documentées dans le code.
- **Poids du score éthique dans le scoring de pertinence** (module `api/scoring`) — la relation exacte entre ce score et le score composite de scoring J3 n'est pas visible dans le module datasets seul.
- **Stratégie de version du guide IA** — le champ `ai_guide` (JSONB) est overwritten à chaque regénération ; il n'y a pas d'historique visible. Est-ce intentionnel ?
- **Limite max de colonnes affichées (20)** — la constante `PREVIEW_MAX_COLUMNS = 20` est hardcodée ; aucun commentaire n'explique si c'est une contrainte UX ou de performance.
- **Comportement attendu si `created_by` est NULL** — le code commente « import système » mais la règle métier sur ce que peut faire l'admin sur ces datasets (vs un contributeur) n'est pas entièrement visible dans ce module.
