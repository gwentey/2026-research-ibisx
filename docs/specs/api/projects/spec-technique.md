# Spec Technique — Projects

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | projects            |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

---

## Architecture du module

Le module `projects` suit la structure en couches appliquée à tous les modules de l'API IBIS-X :

```
routes.py     ← couche HTTP : validation FastAPI, injection des dépendances (DB, JWT claims)
  ↓
service.py    ← couche métier : CRUD, isolation user_id, normalisation des poids, recommandations
  ↓
models.py     ← couche données : ORM SQLAlchemy (Project)
schemas.py    ← contrats Pydantic : ProjectInput / ProjectRead / ProjectPage
```

Le service délègue le calcul de recommandations à `ibis.modules.scoring.service.score_datasets()` sans dupliquer de logique de scoring. Il n'existe pas de couche repository explicite : les requêtes SQLAlchemy sont directement dans `service.py`.

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/api/ibis/modules/projects/routes.py` | Routeur FastAPI : 6 endpoints CRUD + recommandations, doc isolation par user_id | ~62 |
| `apps/api/ibis/modules/projects/service.py` | Logique métier : CRUD isolé, normalisation des poids, conversion vers DTO, délégation scoring | ~110 |
| `apps/api/ibis/modules/projects/models.py` | Modèle ORM `Project` : mixins `UUIDPk` + `Timestamped`, colonnes JSONB | ~26 |
| `apps/api/ibis/modules/projects/schemas.py` | Schémas Pydantic : `ProjectInput` (validation), `ProjectRead` (lecture), `ProjectPage` (pagination) | ~50 |
| `apps/api/alembic/versions/0004_projects.py` | Migration Alembic : création de la table `projects` et index `ix_projects_user_id` | ~40 |
| `apps/api/tests/integration/test_projects.py` | Suite d'intégration : CRUD, isolation, normalisation, cohérence recommandations P3 | ~155 |

---

## Schéma BDD

### Table `projects`

| Colonne | Type | Contraintes | Notes |
|---------|------|-------------|-------|
| `id` | `UUID` | PK | Généré côté application via `uuid.uuid4()` |
| `user_id` | `UUID` | FK → `users.id`, `ON DELETE CASCADE`, index `ix_projects_user_id` | Isolation stricte |
| `name` | `VARCHAR(255)` | NOT NULL | Validé min_length=1 côté Pydantic |
| `description` | `TEXT` | NULL | |
| `criteria` | `JSONB` | NOT NULL, default `{}` | Format `DatasetFilters` sérialisé ; champs inconnus filtrés au write (`exclude_none=True`) |
| `weights` | `JSONB` | NOT NULL, default `{}` | `{criterion_name: float}` ; normalisés si Σ > 1 |
| `created_at` | `TIMESTAMP` | NOT NULL, `server_default=now()` | Via mixin `Timestamped` |
| `updated_at` | `TIMESTAMP` | NOT NULL, `server_default=now()`, `onupdate=now()` | Via mixin `Timestamped` |

La migration est `0004_projects.py` (révision `0004`, dépend de `0003`). La table `experiments` a une FK `project_id → projects.id ON DELETE CASCADE` (migration `0005`).

---

## API / Endpoints

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `GET` | `/api/v1/projects` | Liste paginée des projets de l'utilisateur ; `q` (recherche ilike nom+description), `page` (≥1), `page_size` (1–48, défaut 12) | JWT requis |
| `POST` | `/api/v1/projects` | Crée un projet ; corps `ProjectInput` (`extra="forbid"`) ; réponse 201 + `ProjectRead` | JWT requis |
| `GET` | `/api/v1/projects/{project_id}` | Détail d'un projet ; 404 si absent ou appartient à un autre user | JWT requis |
| `PUT` | `/api/v1/projects/{project_id}` | Remplace entièrement le projet (nom, description, critères, poids) ; réponse 200 + `ProjectRead` | JWT requis |
| `DELETE` | `/api/v1/projects/{project_id}` | Supprime le projet et cascade ses expériences ; réponse 204 | JWT requis |
| `GET` | `/api/v1/projects/{project_id}/recommendations` | Classement complet des datasets selon les critères/poids du projet ; délègue à `score_datasets()` | JWT requis |

---

## Patterns identifiés

### Isolation resource-owner stricte

Toutes les fonctions de service reçoivent `user_id` en paramètre et l'intègrent dans chaque clause `WHERE` SQLAlchemy. La fonction `get_project()` est le point d'entrée commun : elle filtre simultanément sur `Project.id` et `Project.user_id`, et lève `NotFoundError` (→ 404) si l'enregistrement n'est pas trouvé. Les routes `PUT`, `DELETE` et `recommendations` appellent `get_project()` avant de procéder.

### Normalisation conditionnelle des pondérations

```python
def normalize_weights_if_needed(weights: dict[str, float]) -> dict[str, float]:
    total = sum(weights.values())
    if total > 1 and total > 0:
        return {name: round(weight / total, 4) for name, weight in weights.items()}
    return weights
```

La normalisation est appliquée à l'écriture (`create_project`, `update_project`) et ne se distingue pas d'une normalisation à la lecture pour le consommateur de l'API.

### Projection compute-on-read pour active_criteria_count

```python
def active_criteria_count(criteria: dict) -> int:
    return sum(1 for value in criteria.values() if value not in (None, [], "", False))
```

Ce champ n'est pas stocké en base. Il est calculé dans `to_read()` à chaque sérialisation vers `ProjectRead`. Il reflète le nombre de critères ayant une valeur significative (non vide, non nulle, non fausse).

### Délégation scoring (P3)

La fonction `recommendations()` convertit le JSONB `criteria` du projet en `DatasetFilters` via `model_validate`, transforme le dictionnaire `weights` en liste `[CriterionWeight]`, puis appelle `score_datasets()`. Elle ne contient aucune logique de calcul propre.

### Pagination standard

`list_projects()` exécute deux requêtes : `COUNT` pour le total et `SELECT` avec `OFFSET/LIMIT`. La réponse `ProjectPage` inclut `total`, `page`, `page_size`, `total_pages` (`max(1, ceil(total / page_size))`).

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/api/tests/integration/test_projects.py` | `test_crud_and_isolation` : CRUD complet + isolation Alice/Bob (404 sur toutes les opérations cross-user) | Existant |
| `apps/api/tests/integration/test_projects.py` | `test_weights_normalized_when_sum_exceeds_one` : normalisation Σ > 1 et conservation Σ ≤ 1 | Existant |
| `apps/api/tests/integration/test_projects.py` | `test_validation_rejects_unknown_criterion_or_filter` : 422 sur critère ou filtre inconnu | Existant |
| `apps/api/tests/integration/test_projects.py` | `test_recommendations_match_score_endpoint` : résultats identiques entre recommandations et scoring direct (P3) | Existant |
| `apps/api/tests/integration/test_projects.py` | `test_recommendations_of_missing_project_404` : 404 sur recommendations d'un projet inexistant | Existant |

Aucun test unitaire isolé (hors intégration) n'existe pour les fonctions utilitaires `normalize_weights_if_needed()` et `active_criteria_count()`.

---

## Décisions non-ADR (documentées ici)

**404 vs 403 pour les ressources d'un autre utilisateur**
Le service retourne systématiquement 404 (via `NotFoundError`) pour les projets non trouvés, qu'ils n'existent pas ou qu'ils appartiennent à un autre utilisateur. Ce comportement est explicitement documenté dans un commentaire de `get_project()` : _"le projet d'un autre utilisateur est INTROUVABLE (404)"_. Cette convention masque l'existence des ressources aux utilisateurs non autorisés. Elle est confinée au module `projects` et constitue une convention d'API, pas un invariant architectural — elle va en spec-technique.

**Critères stockés sans validation de round-trip au read**
`project.criteria` est stocké via `payload.criteria.model_dump(exclude_none=True)`. La désérialisation inverse (`DatasetFilters.model_validate(project.criteria)`) dans `recommendations()` suppose que le JSONB stocké reste valide vis-à-vis du schéma `DatasetFilters` courant. Aucun mécanisme de migration des données JSONB n'est prévu pour les évolutions futures de `DatasetFilters`.

**Absence de `relationship()` ORM vers Experiment**
Le modèle `Project` ne déclare pas de relation `relationship("Experiment", back_populates="project")`. La cascade de suppression repose uniquement sur la FK base de données (`ON DELETE CASCADE`) déclarée dans la migration `0005_experiments`. Charge à l'ORM de ne pas charger les expériences associées sans jointure explicite.
