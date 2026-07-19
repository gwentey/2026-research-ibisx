# Spec Technique — api/health

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | api/health          |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

## Architecture du module

Le module est délibérément minimal : un seul fichier `routes.py` (pas de `service.py`, pas de `models.py`). Il n'a pas d'état propre et ne persiste rien en base. Toutes les vérifications sont des appels synchrones bloquants effectués dans le thread de la requête FastAPI.

Deux routers distincts sont exposés sous le préfixe `/health` :
- `GET /health` — vérifie les trois dépendances infrastructurelles (DB, Redis, volume)
- `GET /health/worker` — sonde les workers Celery via le bus de contrôle

La logique de vérification du volume est extraite dans une fonction interne `_check_storage(data_dir)` non exposée comme dépendance.

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/api/ibis/modules/health/routes.py` | Endpoints `GET /health` et `GET /health/worker`, modèles Pydantic `HealthReport` et `WorkerHealthReport`, fonction `_check_storage` | ~88 |
| `apps/api/ibis/modules/health/__init__.py` | Marqueur de package Python (vide) | 0 |
| `apps/api/ibis/workers/tasks/smoke.py` | Tâche Celery de démonstration (`smoke_task`) — 6 étapes, 0,8 s/étape, publication de progression via `service.update_progress` | ~45 |
| `apps/api/ibis/core/redis.py` | Client Redis partagé — `get_sync_redis()` (lru_cache) consommé par le health check | ~22 |
| `apps/api/ibis/main.py` | Enregistrement du router health dans l'application FastAPI, avant les autres routers | ~83 |
| `apps/web/app/status/page.tsx` | Page `/status` Next.js — consomme `getHealth` + `getWorkerHealth` du client généré, déclenche le smoke job via SSE | ~260 |
| `apps/web/components/ibis/status/service-card.tsx` | Composant `ServiceCard` (carte avec `ProgressRing` + `ServiceStatusDot`) et `ServiceSubRow` (ligne détail) | ~108 |
| `apps/web/components/ibis/status/service-status-dot.tsx` | Pastille d'état vivante (ok/down/checking) | — |
| `apps/web/components/ibis/status/smoke-timeline.tsx` | Affichage de la timeline des logs du smoke job | — |
| `apps/api/tests/integration/test_health.py` | Tests d'intégration : statut nominal + header `x-request-id` | ~20 |

## Schéma BDD

Aucune table propre. Le health check n'accède à la base que via `SELECT 1` (liveness).

## API / Endpoints

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `GET` | `/api/v1/health` | Rapport de santé (DB + Redis + storage + version). HTTP 200 si tout ok, HTTP 503 si dégradé. | Aucune |
| `GET` | `/api/v1/health/worker` | Sondage des workers Celery (ping timeout=1 s). HTTP 200 si au moins un worker répond, HTTP 503 sinon. | Aucune |

### Schémas de réponse

`HealthReport` :
```python
status: Literal["ok", "degraded"]
database: Literal["ok", "error"]
redis: Literal["ok", "error"]
storage: Literal["ok", "error"]
version: str
```

`WorkerHealthReport` :
```python
status: Literal["ok", "unavailable"]
workers: list[str]   # noms des workers triés
```

## Patterns identifiés

- **Vérification synchrone inline** : les trois checks (DB, Redis, storage) sont effectués séquentiellement dans la fonction de route, sans service layer ni parallélisation. Acceptable pour un endpoint de monitoring peu fréquent.
- **Injection de dépendances FastAPI** : `get_db` et `get_settings` sont injectés via `Depends()`. Le client Redis est obtenu directement via `get_sync_redis()` (lru_cache global) sans injection — asymétrie mineure.
- **Import lazy de `celery_app`** : l'import de `ibis.workers.celery_app` dans `get_worker_health` est différé (import à l'intérieur de la fonction) pour éviter les imports circulaires au démarrage.
- **Import lazy de `__version__`** : `from ibis import __version__` est également différé dans la fonction `get_health` pour la même raison.
- **Ratio de sous-vérifications côté frontend** : la page `/status` calcule elle-même le ratio (`[database, redis, storage].filter(ok).length / 3 * 100`) pour alimenter le `ProgressRing` — la logique de présentation reste côté client, l'API expose les états bruts.

## Décisions techniques notables (non-ADR)

Ces points sont documentés ici car rejetés en ADR par la politique v2.3.0 (module isolé, impact non transverse).

- **HTTP 503 si dégradé** : le code HTTP suit la RFC (503 Service Unavailable) plutôt qu'un HTTP 200 avec flag booléen dans le corps. Pratique standard, non structurante pour d'autres modules (AP-6).
- **Timeout worker à 1 s** : le ping Celery est limité à 1 seconde, valeur choisie pour ne pas bloquer l'affichage de la page de statut. Heuristique d'implémentation locale (AP-3).
- **Vérification du stockage par création de fichier temporaire** : la vérification teste réellement les droits d'écriture (pas seulement l'existence du répertoire). Heuristique locale (AP-3).
- **Smoke task en 6 étapes de 0,8 s** : le découpage pédagogique (init → DB → storage → Redis pub/sub → finalisation → terminé) illustre les mêmes composants que le health check. Heuristique d'implémentation (AP-3).

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/api/tests/integration/test_health.py` | Statut nominal HTTP 200, champs `ok`, champ `version` présent, header `x-request-id` propagé | Existant |
| `GET /health/worker` | Non couvert par les tests | Absent |
| Smoke task | Non couvert par les tests unitaires | Absent |
