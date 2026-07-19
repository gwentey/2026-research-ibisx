# CLAUDE.md — IBIS-X

> Version : 0.1.0 — 2026-07-19
> Framework Zelian : `framework_version: 3.0.0`
> Marker projet : voir `.zelian/project.json` (source de vérité, active les hooks)

<!--
  ⚠️  INDEX COURT (max 80 lignes) — pointe vers les bons fichiers, ne dumpe rien.
  Stack/commandes → .claude/rules/02-stack.md · Patterns/décisions → docs/adr/
  Schéma/API/tests → docs/specs/*/spec-technique.md · Règles métier → spec-fonctionnel.md
-->

Plateforme d'accompagnement Machine Learning de bout en bout pour non-experts (SHS) :
du choix éthique d'un dataset jusqu'à l'explication d'un modèle, sans écrire de code.

## Apps

| App | Stack | Root |
|-----|-------|------|
| api | FastAPI · Python 3.12 · SQLAlchemy 2 · Celery · scikit-learn/SHAP/LIME | `apps/api` |
| web | Next.js 16 (App Router) · TypeScript · next-intl FR/EN · shadcn-ui | `apps/web` |

> BDD PostgreSQL 16 + Redis 7 · client web généré depuis le contrat OpenAPI (jamais de `fetch` manuel).
> Détail complet : `.claude/rules/02-stack.md` · config multi-app : `.claude/zelian-apps.json`.

## Commandes

```bash
docker compose up -d                          # web + api + worker + postgres + redis
docker compose exec api ibis seed             # admin + datasets embarqués (idempotent)
cd apps/api && uv run pytest -q                # tests backend
cd apps/web && pnpm test && pnpm build         # vitest + build
cd apps/api && uv run python -m ibis.export_openapi ../web/lib/api/openapi.json && cd ../web && pnpm generate:api  # régénère le client
```

## Rules actives

- @.claude/rules/00-global.md
- @.claude/rules/01-database.md
- @.claude/rules/02-stack.md
- @.claude/rules/03-retro.md
- @.claude/rules/04-testing.md
- @.claude/rules/05-git-workflow.md
- @.claude/rules/06-adr-policy.md
- @.claude/rules/07-context-discipline.md

## Modules

> Spec technique de chaque module : `docs/specs/{api,web}/<module>/spec-technique.md` (+ `spec-fonctionnel.md`).

### api
| Module | ADRs RETRO |
|--------|---|
| auth | RETRO-api-auth-01, -02 |
| users | RETRO-api-users-01 |
| datasets | RETRO-api-datasets-01, -02 |
| scoring | RETRO-api-scoring-01 |
| projects | RETRO-api-projects-01 |
| experiments | RETRO-api-experiments-01, -02 |
| ml | RETRO-api-ml-01, -02, -03 |
| xai | RETRO-api-xai-01, -02 |
| llm | — (cf. ADR-006) |
| dashboard | RETRO-api-dashboard-01 |
| admin | RETRO-api-admin-01, -02 |
| jobs | — (cf. ADR-004, ADR-007) |
| health | — |

### web
| Module | ADRs RETRO |
|--------|---|
| auth | RETRO-web-auth-01, -02 |
| onboarding | RETRO-web-onboarding-01 |
| datasets | RETRO-web-datasets-01, -02 |
| wizard | — |
| experiments | RETRO-web-experiments-01 |
| fairness | — |
| lenses | — |
| challenges | — |
| formation | RETRO-web-formation-01 |
| dashboard | — |
| admin | — |

> Audit initial, dette technique et plan de remédiation : `docs/quality/`. Cartographie du scan : `docs/retro/discovery.md`.

> **Zelian Compass** : la source de vérité code ↔ doc est `.zelian/compass.json` (cette table n'est qu'une vue humaine).
> Lecture CIBLÉE obligatoire : `.claude/rules/07-context-discipline.md`.
