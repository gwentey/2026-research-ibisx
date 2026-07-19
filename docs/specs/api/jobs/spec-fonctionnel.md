# Spec Fonctionnelle — api/jobs [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | api/jobs            |
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

Aucun RETRO ADR créé pour ce module. Les décisions architecturales clés (BD source
de vérité, SSE + repli polling, Celery 4 files) sont entièrement couvertes par les
ADRs existants :

| ADR | Décision |
|-----|----------|
| [ADR-004](../../../adr/ADR-004-worker-jobs.md) | Worker Celery, jobs asynchrones, DB source de vérité, pub/sub temps réel |
| [ADR-007](../../../adr/ADR-007-temps-reel-contrat.md) | SSE + repli polling, contrat OpenAPI |

---

## Contexte et objectif

Le module `api/jobs` est l'infrastructure transverse de suivi des tâches asynchrones
dans IBIS-X. Toute opération longue — entraînement de modèle ML, génération d'explication
XAI, guide IA d'un dataset — est exécutée en arrière-plan par un worker Celery. Le
module jobs expose la progression de ces tâches au front sous deux formes :
un flux temps réel (SSE via Redis pub/sub) et un endpoint de polling toujours disponible.

La table `jobs` constitue la vue de supervision unique de tout travail asynchrone
du système (référencée ARCH §6.2 dans le code).

## Règles métier (déduites du code)

1. La progression d'un job est un entier entre 0 et 100 inclus. Toute valeur hors
   bornes est clampée (250 → 100, -5 → 0).

2. La base de données est toujours écrite avant la publication Redis. La publication
   sur le canal pub/sub est best-effort (les exceptions sont supprimées silencieusement).
   Le polling via `GET /jobs/{id}` reste donc toujours exact, même si Redis est
   indisponible.

3. `started_at` est valorisé une seule fois, à la première transition vers le statut
   `running`.

4. `finished_at` est valorisé dès que le job atteint un statut terminal
   (`completed`, `failed` ou `cancelled`).

5. Le champ `message` est tronqué à 512 caractères lors de l'écriture.

6. Un flux SSE se ferme automatiquement lorsque le job atteint un statut terminal.
   Si le job est déjà terminal au moment de la connexion, l'état initial est retourné
   immédiatement et le flux se ferme.

7. En l'absence d'événement depuis 15 secondes, le serveur émet un heartbeat SSE
   (`event: heartbeat`) pour maintenir la connexion.

8. L'endpoint de démonstration `POST /jobs/smoke` est désactivé en production
   (retourne 404 si `settings.is_production`).

## Cas d'usage (déduits)

### CU-001 — Lancer une tâche longue et suivre sa progression en temps réel

Un service (experiments, xai, datasets) crée un job via `jobs_service.create_job()`,
puis soumet la tâche Celery correspondante avec le `job_id`. Le front-end ouvre
`GET /api/v1/jobs/{job_id}/events` (SSE) et reçoit en temps réel les mises à jour
de progression publiées par le worker. Le flux se ferme automatiquement à la
complétion ou à l'échec.

### CU-002 — Repli polling si SSE indisponible

Si le client ne supporte pas SSE ou si la connexion est perdue, le front interroge
`GET /api/v1/jobs/{job_id}` à intervalles réguliers (2 secondes côté front).
La réponse reflète toujours l'état exact en base.

### CU-003 — Supervision des jobs en administration

L'interface d'administration liste les jobs récents avec filtres par `kind` et
`status`, en requêtant directement la table `jobs` via SQLAlchemy.

### CU-004 — Démonstration du socle (dev uniquement)

`POST /api/v1/jobs/smoke` crée un job de type `maintenance` et soumet `smoke_task`
au worker. La tâche progresse de 0 à 100 en 6 étapes (0,8 s chacune) pour valider
la chaîne complète API → file Celery → worker → BDD/pub-sub → SSE.

## Dépendances

- `ibis.core.redis` — clients Redis partagés (sync pour le worker, async pour le SSE)
- `ibis.db.engine` — session SQLAlchemy
- `ibis.workers.celery_app` — application Celery (broker Redis)
- `sse-starlette` — librairie FastAPI pour Server-Sent Events
- Modules consommateurs : `api/experiments`, `api/xai`, `api/datasets` (créent des jobs)
- Workers consommateurs : `tasks/train.py`, `tasks/explain.py`, `tasks/smoke.py`
  (appellent `update_progress`)
- `api/admin` (supervise la table `jobs`)

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- Le `JobKind.chat` est présent dans l'énumération mais `answer_chat_question` ne
  crée pas de job `jobs` — le chat XAI est fire-and-forget via Celery sans suivi de
  progression exposé. S'agit-il d'un kind réservé pour une version future ?

- Le `JobKind.import_` est présent dans l'énumération mais aucun worker `tasks/import.py`
  n'existe et aucun appel à `create_job(kind=JobKind.import_)` n'est visible dans
  le code courant. Feature en cours de développement ?

- La politique de rétention des jobs terminés n'est pas explicite. Les résultats
  Celery expirent en 24 h (`result_expires`), mais la table `jobs` ne semble pas
  purgée automatiquement.
