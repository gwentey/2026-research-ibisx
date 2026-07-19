# Spec Technique — api/jobs

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | api/jobs            |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

## Architecture du module

Le module est organisé en quatre composants internes plus une infrastructure partagée :

```
ibis/modules/jobs/
  models.py     — Table SQLAlchemy `jobs`, enums JobKind + JobStatus
  service.py    — create_job, get_job, update_progress, publish_event
  schemas.py    — JobRead (réponse polling), JobEvent (payload SSE/pub-sub)
  routes.py     — GET /{id}, GET /{id}/events (SSE), POST /smoke

ibis/core/
  redis.py      — get_sync_redis(), get_async_redis(), job_channel()
```

Le service est consommé par trois domaines distincts :

- **Créateurs de jobs** : `modules/experiments/service.py`, `modules/xai/service.py`,
  `modules/datasets/routes.py` — chacun crée un job avant de soumettre la tâche Celery.
- **Producteurs de progression** : `workers/tasks/train.py`, `workers/tasks/explain.py`,
  `workers/tasks/smoke.py` — appellent `update_progress()` à chaque étape.
- **Lecteur admin** : `modules/admin/routes.py` — requête directe sur le modèle `Job`.

Le flux de données pour un job actif est le suivant :

```
Celery worker
  → update_progress(db, ...)
      → db.commit()             # DB écrite en premier (durable)
      → publish_event(...)       # best-effort, exceptions supprimées
          → redis.publish("ibis:jobs:{id}", json)
              → SSE endpoint (async pubsub.get_message)
                  → EventSourceResponse → client HTTP
```

En cas d'indisponibilité Redis, le polling `GET /jobs/{id}` reste exact car la DB
est toujours à jour.

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/api/ibis/modules/jobs/models.py` | Modèle SQLAlchemy `Job`, enums `JobKind` et `JobStatus` | ~58 |
| `apps/api/ibis/modules/jobs/service.py` | Logique métier : création, lecture, progression, pub | ~86 |
| `apps/api/ibis/modules/jobs/schemas.py` | Schémas Pydantic `JobRead` et `JobEvent` | ~36 |
| `apps/api/ibis/modules/jobs/routes.py` | Endpoints FastAPI (polling, SSE, smoke) | ~98 |
| `apps/api/ibis/core/redis.py` | Clients Redis partagés (sync/async) + `job_channel()` | ~19 |
| `apps/api/ibis/workers/celery_app.py` | Configuration Celery (4 files, beat, routes de tâches) | ~62 |
| `apps/api/ibis/workers/tasks/smoke.py` | Tâche de démonstration 0→100 en 6 étapes | ~45 |
| `apps/api/ibis/workers/tasks/train.py` | Tâche d'entraînement — consomme update_progress | ~187 |
| `apps/api/ibis/workers/tasks/explain.py` | Tâche XAI — consomme update_progress | ~325 |
| `apps/api/ibis/workers/tasks/maintenance.py` | Tâches périodiques beat (purge stale, expiration chats) | ~38 |
| `apps/api/ibis/modules/experiments/service.py` | Crée jobs `training` | partiel |
| `apps/api/ibis/modules/xai/service.py` | Crée jobs `explanation` | partiel |
| `apps/api/ibis/modules/datasets/routes.py` | Crée jobs `guide` | partiel |
| `apps/api/ibis/modules/admin/routes.py` | Liste/filtre la table `jobs` (supervision) | partiel |
| `apps/api/tests/integration/test_jobs.py` | Tests intégration du cycle de vie + SSE | ~57 |

## Schéma BDD

### Table `jobs`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | UUID | PK | Identifiant unique du job |
| `kind` | ENUM `job_kind` | NOT NULL | training / explanation / chat / import / guide / maintenance |
| `status` | ENUM `job_status` | NOT NULL, default `pending`, index | pending / running / completed / failed / cancelled |
| `user_id` | UUID | nullable, index | Utilisateur propriétaire (pour filtrage admin) |
| `ref_id` | UUID | nullable, index | ID de l'objet domaine lié (experiment, explanation, dataset) |
| `queue` | VARCHAR(32) | default `maintenance` | File Celery cible |
| `progress` | SMALLINT | default 0 | Avancement 0–100 |
| `error_code` | VARCHAR(64) | nullable | Code d'erreur normalisé (ex : `TIMEOUT`, `XAI_FAILED`) |
| `message` | VARCHAR(512) | nullable | Message lisible (tronqué à 512 chars) |
| `started_at` | TIMESTAMP | nullable | Première transition vers `running` |
| `finished_at` | TIMESTAMP | nullable | Transition vers statut terminal |
| `created_at` | TIMESTAMP | NOT NULL (mixin) | Horodatage de création |
| `updated_at` | TIMESTAMP | NOT NULL (mixin) | Mis à jour automatiquement |

Hérite des mixins `UUIDPk` (id UUID auto) et `Timestamped` (created_at / updated_at)
depuis `ibis.db.base`.

### Enum `job_kind`

`training` | `explanation` | `chat` | `import` | `guide` | `maintenance`

### Enum `job_status`

`pending` | `running` | `completed` | `failed` | `cancelled`

Propriété calculée `is_terminal` : True pour `completed`, `failed`, `cancelled`.

## API / Endpoints

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `GET` | `/api/v1/jobs/{job_id}` | Statut courant d'un job (polling, toujours disponible) | Aucune vérifiée dans routes.py (consommé via le front authentifié) |
| `GET` | `/api/v1/jobs/{job_id}/events` | Flux SSE de progression (pub/sub Redis, fermeture auto à terminal) | Aucune vérifiée dans routes.py |
| `POST` | `/api/v1/jobs/smoke` | Démonstration du socle, 201 Created — désactivé en production (404) | Aucune requise |

### Schéma de réponse `JobRead`

Retourné par `GET /{job_id}` et `POST /smoke` :

```json
{
  "id": "uuid",
  "kind": "training",
  "status": "running",
  "user_id": "uuid | null",
  "ref_id": "uuid | null",
  "queue": "training",
  "progress": 40,
  "error_code": null,
  "message": null,
  "created_at": "2026-07-19T10:00:00Z",
  "started_at": "2026-07-19T10:00:01Z",
  "finished_at": null
}
```

### Schéma d'événement SSE `JobEvent`

Payload JSON dans `data:` des événements `progress` :

```json
{
  "job_id": "uuid",
  "status": "running",
  "progress": 50,
  "log_line": "Preprocessing appliqué",
  "error_code": null
}
```

Événements SSE émis :
- `event: progress` — mise à jour de progression (initial + chaque `update_progress`)
- `event: heartbeat` — keepalive toutes les 15 s sans activité

## Canal pub/sub Redis

Format de clé : `ibis:jobs:{job_id}` (string UUID)

Défini dans `ibis/core/redis.py` via `job_channel(job_id: str) -> str`.

Le worker publie via `redis.publish(channel, event.model_dump_json())`.
L'endpoint SSE s'abonne via `pubsub.subscribe(channel)` et consomme
via `pubsub.get_message(ignore_subscribe_messages=True, timeout=15.0)`.

## Patterns identifiés

- **Source de vérité DB-first** : `update_progress` commit la DB avant `publish_event`.
  `publish_event` utilise `contextlib.suppress(Exception)` — le pub/sub est best-effort.

- **Clôture automatique du flux** : la coroutine `event_stream` vérifie
  `JobStatus(payload["status"]).is_terminal` après chaque événement et retourne
  (`return`) pour clore le générateur. La déconnexion client est détectée via
  `request.is_disconnected()` (vérifié à chaque tour de boucle).

- **Nettoyage garanti** : `finally` dans `event_stream` appelle
  `pubsub.unsubscribe` + `pubsub.aclose()` avec `contextlib.suppress`, même en
  cas d'exception ou de déconnexion brutale.

- **Singleton Redis** : `get_sync_redis()` et `get_async_redis()` sont décorées
  `@lru_cache` — un seul client par processus (worker sync, API async).

- **Jauge de progression normalisée** : `max(0, min(100, progress))` dans
  `update_progress` — les workers n'ont pas à gérer les bornes eux-mêmes.

- **Routage Celery par module** : `task_routes` dans `celery_app.py` associe chaque
  sous-module worker à sa file (`training`, `xai`, `llm`, `maintenance`).

- **Heartbeat beat de détection de worker perdu** : `purge_stale_running` s'exécute
  toutes les 5 minutes et passe les jobs `running` sans battement depuis > 10 min
  en `failed` avec code `WORKER_LOST` (ARCH §5.4).

- **Isolation dev/prod** : `smoke_task` et l'endpoint `POST /jobs/smoke` sont
  désactivés en production via `settings.is_production` — la logique de désactivation
  est dans le handler FastAPI (levée de `NotFoundError`).

## Jalons de progression des workers connus

### `smoke_task`
`0` (running) → `10` → `30` → `50` → `70` → `90` → `100` (completed), 0,8 s par étape.

### `train_experiment`
`5` (running) → `10` (chargement) → `30` (données prêtes) → `50` (preprocessing) →
`70` (modèle entraîné) → `90` (artefacts) → `100` (completed).

### `generate_explanation`
`10` (running/chargement) → `35` (calcul SHAP/LIME) → `60` (accord inter-méthodes,
conditionnel) → `80` (rédaction texte) → `100` (completed).

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/api/tests/integration/test_jobs.py` | Cycle de vie complet via service + API REST, clamping de progression, 404 sur UUID inconnu, SSE initial state pour job terminal | Existant |
| Tests SSE live (pub/sub Redis actif) | Comportement du flux en temps réel avec worker actif | Absent (nécessiterait Redis mock ou service réel) |
| Tests smoke endpoint | Vérification de la désactivation en production | Absent |
