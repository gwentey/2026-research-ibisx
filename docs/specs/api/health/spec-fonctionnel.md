# Spec Fonctionnelle — api/health [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | api/health          |
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

*Aucun ADR lié.*

> *Table auto-générée par adr-linker. Ne pas éditer manuellement.*

---

## Contexte et objectif

Le module expose un point d'entrée d'observabilité permettant de connaître l'état opérationnel des quatre composants critiques de la plateforme : API elle-même, base de données PostgreSQL, cache/broker Redis, et volume de stockage. Il alimente la page `/status` du frontend, qui présente ces informations en temps réel à l'opérateur.

Un second endpoint sonde l'état des workers Celery via le mécanisme de control/inspect natif. Enfin, un job de fumée déclenché manuellement depuis la page `/status` valide l'ensemble du pipeline asynchrone (job créé → worker exécuté → progression publiée via Redis pub/sub → SSE reçu par le browser).

## Règles métier (déduites du code)

1. Le statut global de l'API est `ok` uniquement si les trois sous-vérifications (base de données, Redis, stockage) sont toutes au statut `ok` ; dès qu'une seule est en erreur, le statut global passe à `degraded`.
2. Lorsque le statut global est `degraded`, l'endpoint `GET /health` retourne HTTP 503 — un code HTTP 200 signifie que les trois dépendances sont saines.
3. La vérification du stockage consiste à créer un fichier temporaire dans le répertoire `data_dir` configuré par `Settings.data_dir` ; si la création échoue (OS error), l'état passe à `error`.
4. La vérification Redis est une requête `PING` synchrone via le client partagé `get_sync_redis()` ; toute exception (connexion refusée, timeout) produit l'état `error`.
5. La vérification de la base de données exécute `SELECT 1` ; toute exception SQLAlchemy produit l'état `error`.
6. La réponse de santé inclut le champ `version` (valeur de `ibis.__version__`), permettant de vérifier la version déployée depuis la page de statut.
7. Le sondage des workers Celery utilise `celery_app.control.inspect(timeout=1.0).ping()` ; si aucune réponse n'est reçue dans la seconde, le statut est `unavailable` et l'endpoint retourne HTTP 503.
8. La liste des workers répondants est renvoyée triée par nom dans la réponse `WorkerHealthReport`.

## Cas d'usage (déduits)

### CU-001 — Vérification de santé complète
Un opérateur ou un système de monitoring (ex. Docker healthcheck, Kubernetes liveness probe) appelle `GET /api/v1/health`. L'API exécute en séquence les trois vérifications, compose le rapport et retourne HTTP 200 si tout est nominal, HTTP 503 si l'un des composants est en erreur. La page `/status` front consomme cet endpoint au chargement.

### CU-002 — Vérification des workers
L'appel `GET /api/v1/health/worker` permet de confirmer que le conteneur Celery est actif et a répondu au `PING` dans un délai d'une seconde. La page `/status` affiche la liste des workers répondants et leur état.

### CU-003 — Test de fumée du pipeline asynchrone
Depuis la page `/status`, l'opérateur déclenche `POST /api/v1/jobs/smoke` (voir feature `api/jobs`). La tâche `smoke_task` s'exécute côté worker en 6 étapes (10→100 %) avec un délai de 0,8 s entre chaque, publie la progression via Redis pub/sub, et la page affiche la progression en temps réel via SSE.

## Dépendances

- `ibis.core.config.Settings` — fournit `data_dir` et `redis_url`
- `ibis.core.redis.get_sync_redis()` — client Redis partagé (lru_cache)
- `ibis.db.engine.get_db` — session SQLAlchemy injectée par dépendance FastAPI
- `ibis.workers.celery_app.celery_app` — instance Celery pour le sondage des workers
- `ibis.__version__` — version applicative exposée dans la réponse
- Feature `api/jobs` — pour le smoke job (déclenchement et suivi SSE)

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :
- La page `/status` est-elle accessible sans authentification (route publique) ? Le code frontend ne montre pas de guard ; à confirmer côté middleware Next.js et côté API (les endpoints health ne comportent aucun `Depends(get_current_user)` visible dans le code, ce qui suggère un accès non authentifié).
- Le test de fumée est-il destiné uniquement à l'usage dev/staging, ou est-il aussi utilisable en production ?
