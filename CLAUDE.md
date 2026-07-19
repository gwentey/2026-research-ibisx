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
| auth | RETRO-001, RETRO-002 |
| users | RETRO-002 |
| datasets | RETRO-003, RETRO-004 |
| scoring | RETRO-005 |
| projects | RETRO-006 |
| experiments | RETRO-007, RETRO-008 |
| ml | RETRO-009, RETRO-010, RETRO-011 |
| xai | RETRO-002, RETRO-012 |
| llm | — (cf. ADR-006) |
| dashboard | RETRO-013 |
| admin | RETRO-014, RETRO-015 |
| jobs | — (cf. ADR-004, ADR-007) |
| health | — |

### web
| Module | ADRs RETRO |
|--------|---|
| auth | RETRO-016, RETRO-017 |
| onboarding | RETRO-002 |
| datasets | RETRO-018, RETRO-019 |
| wizard | — |
| experiments | RETRO-020 |
| fairness | — |
| lenses | — |
| challenges | — |
| formation | RETRO-021 |
| dashboard | — |
| admin | — |

> Audit initial, dette technique et plan de remédiation : `docs/quality/`. Cartographie du scan : `docs/retro/discovery.md`.

> **Zelian Compass** : la source de vérité code ↔ doc est `.zelian/compass.json` (cette table n'est qu'une vue humaine).
> Lecture CIBLÉE obligatoire : `.claude/rules/07-context-discipline.md`.
