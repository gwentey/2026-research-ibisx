# ADR-004 — Worker & jobs asynchrones

- **Statut** : accepté (2026-07-16)
- **Source** : [docs/refonte/02-ARCHITECTURE.md](../refonte/02-ARCHITECTURE.md) §5.4, §10

## Décision

**Celery 5.4 + Redis** (broker + result backend), un conteneur `worker` construit sur **la même image Docker que l'API** — zéro divergence de code ([NE PAS REPRODUIRE] la copie de `app/ml/` entre images v1).

- 4 files : `training` (concurrence 1–2), `xai`, `llm` (concurrence 4), `maintenance`.
- L'API n'exécute **jamais** de calcul lourd dans une requête HTTP.
- Le worker écrit sa progression **en base (source de vérité)** puis publie sur Redis pub/sub (temps réel SSE).
- `acks_late`, prefetch 1, retries techniques ×3 avec backoff, timeouts durs (training 2 h, xai 30 min, llm 2 min), révocation propre pour l'annulation, détection de worker perdu (> 10 min sans heartbeat → `WORKER_LOST`).
- Beat : purge sessions chat (24 h), nettoyage `/data/tmp`, expiration analyses qualité (7 j).
- Table `jobs` : vue de supervision unique (admin M8).

## Conséquences

- Plus d'appels HTTP internes ni de SQL cross-service : la communication API↔worker = Postgres (état) + Redis (file + pub/sub).
- Scalable verticalement (2ᵉ conteneur worker `-Q training`) sans changer le code.
