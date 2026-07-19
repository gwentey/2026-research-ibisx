# Spec Technique — api/dashboard

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | api/dashboard       |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

## Architecture du module

Le module dashboard est intentionnellement minimal : un seul fichier `routes.py` qui concentre les schémas Pydantic de réponse, les requêtes SQL et la logique d'assemblage. Il n'y a pas de `service.py` ni de `models.py` propres au module — la feature ne possède aucune table et aucune logique métier réutilisable par d'autres modules.

L'endpoint effectue 7 requêtes SQL indépendantes sur une session unique, puis assemble la réponse en mémoire. Aucune mise en cache.

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/api/ibis/modules/dashboard/routes.py` | Schémas Pydantic + endpoint unique + logique SQL + assemblage | ~179 |
| `apps/api/ibis/modules/dashboard/__init__.py` | Module Python vide (marqueur de package) | 0 |
| `apps/api/tests/integration/test_dashboard.py` | Tests d'intégration — KPI exact, compte vide, filtre expériences | ~120 |

## Schéma BDD (applicable)

Le module ne possède aucune table propre. Il agrège les données des tables suivantes :

| Table | Colonnes utilisées | Rôle dans le dashboard |
|-------|-------------------|------------------------|
| `experiments` | `id`, `user_id`, `project_id`, `dataset_id`, `status`, `duration_seconds`, `created_at`, `updated_at`, `draft_state` | KPI, activité récente, brouillon |
| `projects` | `id`, `user_id`, `name`, `updated_at` | Compteur, liste récente |
| `datasets` | `id`, `display_name` | Nom lisible dans activité et brouillon (JOIN) |
| `explanations` | `id`, `user_id`, `experiment_id`, `type`, `method_used`, `status`, `created_at` | Activité récente (côté XAI) |

## API / Endpoints

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `GET` | `/api/v1/dashboard` | Retourne KPIs + activité récente + projets récents + brouillon en attente | JWT requis (`CurrentClaims`) |

**Schéma de réponse `DashboardResponse`** :

```
DashboardResponse
├── kpis: DashboardKpis
│   ├── total_experiments: int
│   ├── active_projects: int
│   ├── success_rate: float | None
│   └── average_duration_seconds: float | None
├── recent_activity: list[ActivityItem]
│   ├── kind: "experiment" | "explanation"
│   ├── ref_id: UUID
│   ├── experiment_id: UUID
│   ├── label: str  (display_name du dataset OU method_used/type de l'explication)
│   ├── status: str
│   └── created_at: datetime
├── recent_projects: list[RecentProject]
│   ├── id: UUID
│   ├── name: str
│   └── updated_at: datetime
└── pending_draft: WizardDraftPointer | None
    ├── experiment_id: UUID
    ├── project_id: UUID
    ├── dataset_id: UUID
    ├── dataset_name: str
    └── updated_at: datetime
```

**`operation_id` OpenAPI** : `getDashboard` (utilisé par le client TypeScript généré).

## Séquence des requêtes SQL

1. `COUNT(experiments)` WHERE `user_id = $uid` AND `status != 'draft'` → `total_experiments`
2. `COUNT(projects)` WHERE `user_id = $uid` → `active_projects`
3. `COUNT(experiments)` WHERE `user_id = $uid` AND `status = 'completed'` → `completed`
4. `COUNT(experiments)` WHERE `user_id = $uid` AND `status IN ('completed', 'failed')` → `finished`
5. `AVG(duration_seconds)` WHERE `user_id = $uid` AND `status = 'completed'` → `average_duration`
6. TOP 10 experiments (non-draft) + TOP 10 explanations → fusionnés en Python, re-triés, tronqués à 10
7. TOP 4 projects par `updated_at DESC`
8. TOP 1 experiment en `status = 'draft'` par `updated_at DESC` + JOIN dataset

Total : 8 requêtes SQL par appel, toutes synchrones sur la même session SQLAlchemy.

## Patterns identifiés

- **Module thin controller** : pas de couche service intermédiaire. La route est à la fois contrôleur et couche de requêtes. Acceptable pour un endpoint unique sans logique de mutation.
- **Assembly en application layer** : la fusion des activités (experiments + explanations) est faite en Python après deux requêtes SQL séparées, plutôt qu'avec un UNION SQL. Cela simplifie le code au prix d'un double passage en DB.
- **Schémas Pydantic co-localisés** : `DashboardKpis`, `ActivityItem`, `RecentProject`, `WizardDraftPointer`, `DashboardResponse` sont définis dans le même fichier que la route. Pas de `schemas.py` séparé.
- **Guard P1 sur success_rate** : `success_rate = round(completed/finished, 4) if finished > 0 else None` — la condition sur `finished > 0` est l'invariant central du module (voir ADR RETRO-api-dashboard-01).
- **Import défensif** : `_ = ExplanationStatus` en fin de fonction pour garantir que l'import est visible dans les outils d'analyse statique, même si la variable n'est pas directement utilisée dans la logique de la route.

## Décisions documentées ici (rejetées comme ADR)

- **Filtre `status != 'draft'` sur total_experiments** : les brouillons sont exclus des KPI. Décision confinée à ce module (Q3 = borderline) et implémentation directe d'une règle métier évidente. Documentée ici plutôt qu'en ADR.
- **`cancelled` exclu du dénominateur `finished`** : seuls `completed` et `failed` comptent comme expériences terminées pour le taux de succès. Choix local, déductible du domaine ML (une annulation n'est pas un résultat). Documenté ici.
- **Borne 10 côté DB avant fusion** : les deux requêtes activité sont limitées à 10 résultats avant d'être fusionnées. Heuristique de performance — AP-3. Documenté ici.
- **4 projets récents** : limite arbitraire, confinée à un paramètre `.limit(4)`. Pas d'impact transverse. Documenté ici.

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/api/tests/integration/test_dashboard.py` | KPI exacts sur état connu (3 expériences, 1 brouillon, 2 projets), compte vide (success_rate=None), filtre expériences global | Existant |
