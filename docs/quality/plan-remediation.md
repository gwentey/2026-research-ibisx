# Plan de Remédiation — IBIS-X v2

> Basé sur la dette identifiée dans `dette-technique.md` (2026-07-19).
> Référence items : C1–C5 (critique), M1–M12 (majeur), N1–N12 (mineur).

---

## Stratégie

Corriger d'abord les cinq items critiques qui créent des risques de comportement incorrect
silencieux en production (LLM sans tests, viz_data non validé, bug timezone, limite
challenge). Ensuite stabiliser les zones sans couverture de tests pour rendre les PRs sûres
sans dépendre du seul e2e nightly. Enfin améliorer progressivement les contrats inter-apps
et la maintenabilité du code.

---

## Phase 1 — Corrections critiques (Sprint 1)

| # | Action | Réf. dette | Feature | Effort | Prérequis |
|---|--------|-----------|---------|--------|-----------|
| 1.1 | Ajouter des tests pour `api/llm` : mock `httpx.AsyncClient` pour couvrir `client.py` (happy path, timeout, fallback), prompts `xai_text.py` (3 niveaux audience, build_context, numbers_exist_in_context), `guides.py` (dataset guide, questions suggérées, fallback déterministe) | C1 | api/llm | M | Néant |
| 1.2 | Typer `viz_data` avec un modèle Pydantic `VizData` dans `evaluation.py` ; exporter dans l'OpenAPI via un schéma `ExperimentVizData` dans `schemas.py` ; vérifier que `result-charts.tsx` consomme les types générés | C2 | api/ml, web/experiments | L | Néant |
| 1.3 | Ajouter des tests unitaires pour les tasks Celery : extraire les fonctions internes de `train.py` et `explain.py` en helpers testables sans broker Celery (pattern : fonctions pures `_run_train_pipeline(df, config)` + tests sur inputs/outputs) | C3 | api/ml, api/xai | L | Néant |
| 1.4 | Corriger le bug timezone dans `experiments/service.py` : remplacer `datetime.now(UTC).replace(tzinfo=None)` par `datetime.now(UTC)` sur toutes les lignes concernées (105, 196, 391) ; utiliser des comparaisons tz-aware dans tout `service.py` | C4 | api/experiments | XS | Néant |
| 1.5 | Corriger `resolveDatasetId` pour paginer jusqu'à trouver le slug ou épuiser le catalogue (boucle sur `page`/`total_pages`) ; ajouter un test Vitest couvrant le cas "dataset en page 2" | C5 | web/challenges | S | Néant |

---

## Phase 2 — Stabilisation (Sprints 2–3)

| # | Action | Réf. dette | Feature | Effort | Prérequis |
|---|--------|-----------|---------|--------|-----------|
| 2.1 | Ajouter tests unitaires `ethics.py` : `ethical_score()` avec les 3 états (None, False, True), cas de liste vide, invariant dénominateur = `len(ETHICAL_CRITERIA)` | M1 | api/datasets | XS | Néant |
| 2.2 | Ajouter tests unitaires `filters.py` : tester les 5 filtres les plus critiques (domaine, ethical_score_min, has_missing_values, bornes numériques, tri combiné) avec une BDD de test | M2 | api/datasets | S | BDD test disponible (conftest) |
| 2.3 | Ajouter tests `importer.py` : import YAML idempotent (2 appels → 1 dataset), gestion des champs manquants dans le YAML | M3 | api/datasets | S | Néant |
| 2.4 | Créer tests Vitest pour `web/wizard` : valider les transitions d'étapes du store wizard (draft persistence, step navigation, reset), les guards (étape non accessible sans étape précédente), les helpers de calcul | M4 | web/wizard | M | Néant |
| 2.5 | Créer tests Vitest pour `web/datasets` : state machine `useCatalog` (loading/ready/error), debounce, race condition prevention (requestId), pagination reset sur filtre | M4 | web/datasets | M | Néant |
| 2.6 | Créer tests Vitest pour `web/auth` : validation des formulaires login/register (zod schemas), store auth (token en mémoire, jamais localStorage), hook `useAuth` | M4 | web/auth | S | Néant |
| 2.7 | Ajouter un test CI de synchronisation `ETHICAL_KEYS` : dans le job `contract`, après `pnpm generate:api`, vérifier via un script que les 10 clés de `ETHICAL_KEYS` (frontend) matchent les 10 critères retournés par `GET /datasets/facets` ou un endpoint dédié | M8 | api/datasets, web/datasets | S | Phase 1 complète (CI stable) |
| 2.8 | Corriger le bug timezone sur les autres datetimes naïfs dans `service.py` (lignes 196 et 391) et ajouter des tests de quota couvrant un run à minuit UTC | C4 (extension) | api/experiments | XS | 1.4 complété |
| 2.9 | Ajouter un backoff exponentiel au polling `ChallengeDebrief` (1s → 2s → 4s → 8s → max 30s) et une limite de tentatives (ex. 60 tentatives) | M11 | web/challenges | XS | Néant |
| 2.10 | Couvrir `result-charts.tsx` : tests unitaires pour `metricTone`, `metricRatio`, `scoreCellStyle`, et le rendu basique de `ConfusionMatrix` et `ImportanceChart` (données bien mappées sur les axes) | M10 | web/experiments | M | Néant |
| 2.11 | Ajouter tests Vitest pour `web/fairness` : logique de `detectSensitiveFeatures` (partagée avec lenses), rendu du `FairnessPanel` sur une réponse d'équité mockée | M4 | web/fairness | S | Néant |
| 2.12 | Déplacer `XaiAudience` de `auth/models.py` vers `xai/models.py` (ou vers `ibis/core/enums.py`) ; mettre à jour tous les imports ; vérifier que mypy passe | M7 | api/auth, api/xai | S | Néant |

---

## Phase 3 — Amélioration continue (Sprints 4+)

| # | Action | Réf. dette | Feature | Effort | Prérequis |
|---|--------|-----------|---------|--------|-----------|
| 3.1 | Générer les types TypeScript de `BlockDocument` depuis le schéma Pydantic (`pydantic2ts` ou export OpenAPI) pour éliminer la duplication manuelle `blocks.py`/`ibis-blocks.tsx` ; ajouter la vérification en CI | M5 | api/xai, web/xai | L | Phase 2 complète |
| 3.2 | Ajouter un journal d'audit des mouvements de crédits : nouvelle table `credit_events` (user_id, delta, reason, experiment_id nullable, created_at) ; hooks dans `enforce_quotas_and_debit` et `cancel_experiment` | M6 | api/experiments, api/users | M | Migration Alembic |
| 3.3 | Déplacer `vocab.py` de `ibis/modules/ml/` vers `ibis/core/` pour supprimer le couplage datasets → ml | M9, N12 | api/datasets, api/ml | XS | Tests 2.1–2.3 en place |
| 3.4 | Rendre les seuils de tonalité métrique configurables : extraire `>= 0.8 → good` et `>= 0.6 → medium` dans une constante nommée `METRIC_THRESHOLDS` et couvrir par un test | N10 | web/experiments | XS | Néant |
| 3.5 | Documenter la sélection SHAP/LIME dans un registre extensible : remplacer la heuristique duck-typing par un attribut `supports_tree_explainer: bool` sur chaque `AlgorithmSpec` du `REGISTRY` | M12 | api/xai, api/ml | S | Néant |
| 3.6 | Ajouter la limite de comparaison (8 expériences) comme constante nommée `MAX_COMPARE_EXPERIMENTS` dans `project-experiments-tab.tsx` | N9 | web/experiments | XS | Néant |
| 3.7 | Ajouter un `BLOCK_MIN_AUDIENCE` registration guard : commentaire obligatoire + lint custom ou commentaire `// [AJOUTER ICI tout nouveau bloc]` pour rappeler l'enregistrement | N1 | web/experiments | XS | Néant |
| 3.8 | Ajouter des tests pour `purge_stale_running` : simuler une expérience `running` avec `updated_at` vieux de 11 minutes → vérifier passage en `failed` | N11 | api/experiments | S | Conftest avec BDD de test |
| 3.9 | Documenter la référence Khelifi 2024 dans `ethics.py` : ajouter la citation complète (auteur, titre, année, DOI ou URL) dans le docstring de `ETHICAL_CRITERIA` | N8 | api/datasets | XS | Néant |
| 3.10 | Versioner les prompts LLM : extraire les prompts système de `xai_text.py` vers des fichiers `.txt` ou des constantes versionnées avec un schéma de version lisible (`PROMPT_VERSION = "2.1"`) | N6 | api/llm | S | Phase 1 (tests LLM) complète |
| 3.11 | Ajouter des tests Vitest pour `web/dashboard` et `web/admin` : rendu des tuiles KPI avec données mockées, gestion de l'état de chargement | M4 (résiduel) | web/dashboard, web/admin | M | Néant |
| 3.12 | Ajouter monitoring de latence sur `GET /datasets` (temps de calcul `ethical_score` par batch) ; définir un seuil d'alerte pour déclencher la migration vers vue matérialisée PostgreSQL | N5 | api/datasets | S | Infrastructure observabilité disponible |

---

## Dépendances entre actions

```
1.4 (bug timezone) → 2.8 (extension timezone + tests)

Phase 1 complète (CI stable) → 2.7 (test CI ETHICAL_KEYS)

Phase 2 complète → 3.1 (génération BlockDocument TypeScript)
                → 3.3 (déplacement vocab.py — tests de régression disponibles)

1.1 (tests LLM) → 3.10 (versioning prompts)

2.1 (tests ethics.py)
2.2 (tests filters.py)
2.3 (tests importer.py)  → 3.3 (vocab.py déplacement sûr)
```

Ordre de blocage critique :
- **1.4** doit être livré avant 2.8 (même fichier, même logique)
- **1.2** (VizData Pydantic) doit être livré avant toute évolution de `evaluation.py`
- **1.1** (tests LLM) doit être livré avant tout ajout de prompt ou de modèle LLM
- **2.7** (test CI ETHICAL_KEYS) doit être livré avant d'envisager une évolution de la taxonomie éthique
