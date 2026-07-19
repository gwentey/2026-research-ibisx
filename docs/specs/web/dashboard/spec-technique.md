# Spec Technique — web/dashboard

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | web/dashboard       |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

---

## Architecture du module

Le dashboard est une surface frontend (Next.js App Router, `"use client"`) qui consomme un endpoint dédié côté API (`GET /dashboard`). Le backend concentre toute la logique d'agrégation en une seule requête HTTP ; le frontend assemble les composants sans logique métier additionnelle.

```
DashboardPage (page.tsx)
├── GET /dashboard  ←  getDashboard() [client généré OpenAPI]
│       ↓ DashboardResponse
├── MissionHeroCard        ← WizardDraftPointer | null
├── StatTile × 4           ← DashboardKpis
├── RecentActivityTimeline ← ActivityItem[]
├── RecentProjectsList     ← RecentProject[]
└── ActionTile × 3         ← liens statiques (pas de données API)
```

**Backend (routes.py)** : un seul `APIRouter` avec un seul handler `get_dashboard`. Le handler exécute 5 requêtes SQLAlchemy indépendantes + 2 requêtes de liste, assemble la réponse et retourne un `DashboardResponse`. Aucun service métier séparé — toute la logique est dans le handler.

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/web/app/(app)/dashboard/page.tsx` | Page principale — orchestration des composants, appel API unique, squelette de chargement, définition d'`ActionTile` (composant local) | ~230 |
| `apps/web/components/ibis/dashboard/stat-tile.tsx` | Tuile KPI tonale — icône, valeur avec count-up, badge de tendance optionnel | ~87 |
| `apps/web/components/ibis/dashboard/mission-hero-card.tsx` | Carte hero — brouillon en cours ou état vide, intègre `MissionStepper` et `DomainPattern` | ~85 |
| `apps/web/components/ibis/dashboard/recent-activity-timeline.tsx` | Timeline d'activité — expériences + explications, statut sémantique (pastille colorée + halo pulse pour `running`), temps relatif `Intl` | ~199 |
| `apps/web/components/ibis/dashboard/recent-projects-list.tsx` | Liste de projets récents — monogramme à 2 lettres, teinte tonal déterministe par hash, temps relatif `Intl` | ~150 |
| `apps/api/ibis/modules/dashboard/routes.py` | Handler FastAPI — 7 requêtes SQLAlchemy, agrégations, assemblage `DashboardResponse` | ~179 |
| `apps/web/messages/fr.json` | Traductions FR — clé `dashboardHome` | — |
| `apps/web/messages/en.json` | Traductions EN — clé `dashboardHome` | — |

---

## Schéma BDD (tables lues)

Le handler `get_dashboard` effectue des lectures (jamais d'écriture) sur les tables suivantes :

| Table | Usage |
|-------|-------|
| `experiments` | `COUNT` total (hors draft), `COUNT` completed, `COUNT` finished (completed+failed), `AVG(duration_seconds)` des completed, liste des 10 derniers non-draft, brouillon le plus récent (draft) |
| `projects` | `COUNT` total, liste des 4 derniers par `updated_at` |
| `datasets` | `JOIN` sur `experiments` pour récupérer `display_name` (label de l'activité et nom du dataset dans le brouillon) |
| `explanations` | Liste des 10 dernières par `created_at` |

Toutes les requêtes sont filtrées par `user_id` (isolation stricte par utilisateur).

---

## API / Endpoints

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `GET` | `/dashboard` | Retourne l'agrégat complet du tableau de bord : KPIs, activité récente, projets récents, brouillon pending | JWT requis (`CurrentClaims`) |

**Schéma de réponse `DashboardResponse`** :

```python
DashboardKpis:
  total_experiments: int           # COUNT hors draft
  active_projects: int             # COUNT tous projets
  success_rate: float | None       # completed / (completed+failed), None si finished=0
  average_duration_seconds: float | None  # AVG(duration_seconds) completed, None si absent

ActivityItem:
  kind: Literal["experiment", "explanation"]
  ref_id: UUID
  experiment_id: UUID
  label: str                       # display_name du dataset (exp) ou method_used (explication)
  status: str
  created_at: datetime

RecentProject:
  id: UUID
  name: str
  updated_at: datetime

WizardDraftPointer:
  experiment_id: UUID
  project_id: UUID
  dataset_id: UUID
  dataset_name: str
  updated_at: datetime

DashboardResponse:
  kpis: DashboardKpis
  recent_activity: list[ActivityItem]   # max 10 après tri fusionné
  recent_projects: list[RecentProject]  # max 4 (LIMIT backend)
  pending_draft: WizardDraftPointer | None
```

---

## Patterns identifiés

- **Single fetch** : toute la donnée du tableau de bord est chargée en un seul appel API (`useEffect` + `getDashboard()`). Aucun cache, aucun refresh automatique.
- **Squelette de chargement** : pendant le chargement (`data === null`), la page affiche des `<Skeleton>` sans interaction possible. Pas d'état d'erreur explicite — en cas d'échec, la page reste sur le squelette.
- **Count-up animation** : `CountAnimation` (composant interne) anime le chiffre de 0 à la valeur cible au montage. Neutralisé si `prefers-reduced-motion` (géré par le composant lui-même).
- **Teintes tonales chart-N** : les composants utilisent exclusivement les tokens `chart-1` à `chart-5` du design system pour colorer les icônes et badges — jamais de couleur CSS arbitraire. Les fragments de classes Tailwind sont déclarés littéralement pour que le JIT les conserve.
- **Hash déterministe pour les monogrammes** : `toneIndex(id)` dans `RecentProjectsList` calcule un index stable à partir du hash polynomial de l'UUID du projet. La teinte d'un projet ne change jamais quelle que soit sa position dans la liste.
- **Temps relatif natif** : `relativeDate()` (dupliqué dans `RecentActivityTimeline` et `RecentProjectsList`) utilise `Intl.RelativeTimeFormat` avec repli sur `toLocaleDateString()` au-delà de 30 jours. Aucune lib externe de formatage de date.
- **Motif `DomainPattern dots` réservé** : le motif visuel points chart-2 est utilisé exclusivement dans la carte hero du dashboard (convention documentée dans `docs/refonte/00-synthese.md`).
- **Fusion et tri côté backend** : les listes d'expériences et d'explications sont récupérées séparément puis fusionnées et triées par `created_at` en Python avant d'être retournées (`activity.sort(key=lambda item: item.created_at, reverse=True)`).

---

## Décisions notables (non-ADR)

Ces décisions techniques ont été identifiées et évaluées contre la politique ADR v2.3.0. Elles ne franchissent pas les filtres (catégorie absente ou anti-pattern ou Q3=NON — portée mono-module) et sont documentées ici.

| Décision | Raison du non-ADR |
|----------|-------------------|
| Agrégations SQL réelles, zéro valeur décorative (P1) | Q3=NON — invariant confiné au seul module dashboard |
| `success_rate = null` (pas de faux 0 %) quand `finished = 0` | AP-3 — heuristique d'implémentation |
| Un seul appel réseau `GET /dashboard` | AP-3 — optimisation locale d'implémentation |
| `LIMIT 4` backend pour `recent_projects` | AP-7 — détail de requête non-architectural |
| Count-up animation avec neutralisation `reduced-motion` | AP-2 / AP-3 — configuration d'animation UI |
| Teintes `chart-*` littérales dans les record de classes | AP-2 — configuration d'outils (Tailwind JIT) |

---

## Configuration i18n

L'ensemble des textes visibles est externalisé sous la clé `dashboardHome` dans `apps/web/messages/fr.json` et `en.json`. Les sous-clés couvrent : `welcome`, `kpis.*`, `activity.*`, `quickActions.*`, `recentProjects.*`, `hero.*`.

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| _(aucun)_ | Le module dashboard n'a pas de fichier de test Vitest ni de spec Playwright dédié | Absent |

> Point de vigilance : la logique de calcul `success_rate` et la condition `null` méritent des tests unitaires côté API (pytest sur `routes.py`) et des tests d'intégration côté front (rendu squelette → rendu chiffres réels).
