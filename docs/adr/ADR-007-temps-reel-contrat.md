# ADR-007 — Temps réel & contrat front/back

- **Statut** : accepté (2026-07-16)
- **Source** : [docs/refonte/02-ARCHITECTURE.md](../refonte/02-ARCHITECTURE.md) §5.2–5.3

## Décision

**Temps réel : SSE + repli polling.**
- `GET /api/v1/jobs/{job_id}/events` : l'API s'abonne à Redis pub/sub (alimenté par le worker) et pousse `{status, progress, log_line}`.
- Tous les endpoints de statut restent interrogeables (polling 2 s) si SSE indisponible.
- WebSocket non retenu : aucun besoin bidirectionnel ([NE PAS REPRODUIRE] X9, le chat bloquant 60 s — le chat XAI est requête → job → réponse).

**Contrat unique : OpenAPI → client TypeScript GÉNÉRÉ.**
- FastAPI génère l'OpenAPI exhaustif (Pydantic v2, `extra="forbid"` sur les payloads d'écriture).
- `@hey-api/openapi-ts` génère `apps/web/lib/api/generated` (types + fonctions typées + client fetch). Le front n'écrit **JAMAIS** un appel fetch à la main ni ne redéclare un type d'API.
- La CI échoue si le client commité n'est pas à jour avec le schéma (job `contract`).

## Conséquences

- Le mal n°1 de la v1 (dérive des contrats front/back) est rendu structurellement impossible.
- Régénération locale : `uv run python -m ibis.export_openapi ../web/lib/api/openapi.json` puis `pnpm generate:api`.
