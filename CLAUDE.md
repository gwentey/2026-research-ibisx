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

### api
| Module | Spec technique | ADRs |
|--------|---|---|
| datasets | docs/specs/api/datasets/spec-technique.md | RETRO-api-datasets-01, -02 |
| experiments | docs/specs/api/experiments/spec-technique.md | RETRO-api-experiments-01, -02 |
| ml | docs/specs/api/ml/spec-technique.md | RETRO-api-ml-01, -02, -03 |
| xai | docs/specs/api/xai/spec-technique.md | RETRO-api-xai-01, -02 |

### web
| Module | Spec technique | ADRs |
|--------|---|---|
| datasets | docs/specs/web/datasets/spec-technique.md | RETRO-web-datasets-01, -02 |
| experiments | docs/specs/web/experiments/spec-technique.md | RETRO-web-experiments-01 |
| fairness | docs/specs/web/fairness/spec-technique.md | — |
| challenges | docs/specs/web/challenges/spec-technique.md | — |

> **16 autres features** scannées mais pas encore documentées (voir `docs/retro/discovery.md`) :
> api/{auth,users,scoring,projects,llm,dashboard,admin,jobs,health} · web/{auth,onboarding,wizard,lenses,formation,dashboard,admin}.
> Audit initial + dette + plan : `docs/quality/`.

> **Zelian Compass** : la source de vérité code ↔ doc est `.zelian/compass.json` (cette table n'est qu'une vue humaine).
> Lecture CIBLÉE obligatoire : `.claude/rules/07-context-discipline.md`.
