# Stack technique du projet

> Fichier généré automatiquement par le subagent `stack-detector` lors de l'initialisation.
> Dernière détection : 2026-07-19

## Apps (monorepo)

| App | Racine | Stack |
|-----|--------|-------|
| `api` | `apps/api` | FastAPI (Python 3.12) |
| `web` | `apps/web` | Next.js 16 (App Router, TypeScript) |

Le monorepo n'utilise pas de workspace manager (pas de `turbo.json`, `nx.json` ni `pnpm-workspace.yaml` à la racine). La coordination entre apps est assurée par Docker Compose. Le frontend et le backend sont deux projets indépendants avec leurs propres gestionnaires de paquets (`pnpm` pour web, `uv` pour api).

---

## Frontend (`apps/web`)

- **Framework :** Next.js 16.2.10
- **Langage :** TypeScript 5.9
- **React :** 19.x
- **UI :** shadcn/ui (composants Radix UI + class-variance-authority + clsx + tailwind-merge)
- **Styles :** Tailwind CSS 4 (PostCSS)
- **State management :** Zustand 5 (store auth et stores feature-level)
- **i18n :** next-intl 4 — locales FR et EN, fichiers dans `messages/fr.json` et `messages/en.json`
- **Charts :** Recharts 2.15
- **Animations :** Motion 12 (successeur Framer Motion)
- **Formulaires :** react-hook-form 7 + zod 3 (validation)
- **Client API :** @hey-api/openapi-ts 0.99 — client TypeScript généré depuis `lib/api/openapi.json`, sortie dans `lib/api/generated/`
- **Éditeur rich-text :** Tiptap 3
- **DnD :** @dnd-kit + @hello-pangea/dnd
- **Structure :** App Router (dossier `app/`), routes groupées `(app)/` et `(guest)/`, pas de dossier `src/`
- **Thème :** next-themes (dark/light)

### Conventions frontend

- Les routes authentifiées sont sous `app/(app)/`, les routes publiques sous `app/(guest)/`
- L'alias TypeScript `@` pointe sur la racine `apps/web` (pas de `src/`)
- Le client API généré NE DOIT PAS être édité manuellement — régénérer via `pnpm generate:api`
- Le client API utilise `baseUrl: ""` côté navigateur (même origine, rewrite Next.js vers `/api/*`) et `INTERNAL_API_URL` côté serveur (RSC/route handlers)
- Les composants UI du kit shadcn sont dans `components/ui/`
- Les hooks custom sont dans `hooks/`
- La logique métier est dans `lib/` (sous-dossiers par domaine : `auth/`, `datasets/`, `challenges/`, `xai/`, etc.)
- L'i18n est obligatoire pour tout texte visible — les clés vont dans `messages/fr.json` ET `messages/en.json`

### Commandes frontend

```bash
# Depuis apps/web
pnpm dev             # Serveur dev sur :3000 (hot reload)
pnpm build           # Build production Next.js
pnpm start           # Serveur production sur :3000
pnpm lint            # ESLint 9
pnpm typecheck       # tsc --noEmit (vérification types sans emit)
pnpm test            # Vitest (tests unitaires, dossier tests/)
pnpm e2e             # Playwright (dossier e2e/, nécessite la stack Docker démarrée)
pnpm generate:api    # Régénère lib/api/generated depuis lib/api/openapi.json
```

---

## Backend (`apps/api`)

- **Framework :** FastAPI 0.115+ (ASGI via Uvicorn)
- **Langage :** Python 3.12
- **Package manager :** uv (pyproject.toml + uv.lock)
- **Package applicatif :** `ibis` (installé en mode editable, entrypoint `ibis.main:app`)
- **ORM :** SQLAlchemy 2.0 (ORM déclaratif, `DeclarativeBase`, expressions typées `Mapped`)
- **Migrations :** Alembic (dossier `alembic/`, auto-apply au démarrage via `alembic upgrade head`)
- **Driver BDD :** psycopg 3 (binary)
- **Base de données :** PostgreSQL 16-alpine (image Docker)
- **Cache / Broker :** Redis 7-alpine
- **Queue de tâches :** Celery 5 — 4 queues : `training`, `xai`, `llm`, `maintenance` ; worker en mode beat (scheduler intégré) ; même image Docker que l'API (ADR-004)
- **Auth :** JWT maison (HS256, argon2id pour les mots de passe) + Google OIDC direct (ADR-003) — PAS de dépendance fastapi-users
- **Validation :** Pydantic v2 (schémas + pydantic-settings pour la config)
- **Logging :** structlog (JSON structuré)
- **LLM :** OpenRouter API exclusivement (ADR-006), clé `OPENROUTER_API_KEY`, modèle configurable via `LLM_MODEL`
- **ML/XAI :** scikit-learn 1.5, SHAP 0.49, LIME 0.2, pandas 2.x, numpy 1.x, scipy
- **Stockage fichiers :** local (`/data`) ou S3 selon `STORAGE_BACKEND` (ADR-005)
- **Structure :** architecture modulaire par domaine dans `ibis/modules/` (auth, datasets, experiments, ml, xai, projects, scoring, users, jobs, dashboard, admin, health)

### Conventions backend

- Chaque module a sa propre structure : `routes.py`, `schemas.py`, `service.py`, `models.py`
- La configuration vient exclusivement des variables d'environnement via `ibis.core.config.Settings` (pydantic-settings) — aucune constante métier en dur dans le code
- Le worker Celery partage la même image que l'API mais NE recharge PAS à chaud (`--reload` absent sur le worker) — redémarrer le conteneur worker après modification du code des tasks
- Les migrations Alembic sont jouées automatiquement au démarrage du conteneur api (`alembic upgrade head`)
- Pas de clé LLM en dev par défaut (`OPENROUTER_API_KEY=""`) — les features LLM tombent en fallback silencieux
- L'OpenAPI est exporté via `ibis export-openapi` (cli typer) pour alimenter le client frontend
- Ruff est le linter principal (remplace flake8 + isort + pyupgrade), mypy pour la vérification de types

### Commandes backend

```bash
# Depuis apps/api (avec uv)
uv run uvicorn ibis.main:app --reload --port 8000   # Serveur dev
uv run alembic upgrade head                          # Appliquer les migrations
uv run alembic revision --autogenerate -m "..."      # Créer une migration
uv run pytest                                        # Tests (unit + integration dans tests/)
uv run ruff check .                                  # Lint
uv run ruff format .                                 # Format
uv run mypy ibis/                                    # Type check
uv run ibis export-openapi                           # Exporter openapi.json pour le frontend
uv run ibis seed                                     # Seeder les datasets embarqués (dev)

# Via CLI ibis (installé en editable)
ibis seed
ibis export-openapi
```

---

## Outils transverses

- **Gestionnaire de paquets :** pnpm 10 (frontend), uv (backend Python)
- **Tests frontend :** Vitest 4 (unitaires), Playwright 1.61 (e2e, parcours complets contre Docker Compose)
- **Tests backend :** pytest 8 (unit + integration, dossier `tests/`)
- **Linter frontend :** ESLint 9 (`eslint.config.mjs`) + Prettier 3 + prettier-plugin-tailwindcss
- **Linter backend :** Ruff 0.6 (lint + format), mypy 1.11 (type check)
- **CI/CD :** GitHub Actions (`.github/workflows/` — job e2e nightly)
- **Docker :** docker-compose.yml (dev — 5 services : web, api, worker, postgres, redis) + compose.prod.yml (prod avec Caddy TLS)
- **Reverse proxy prod :** Caddy (TLS automatique, routage `/api/*` vers le backend)
- **Monorepo :** Pas de workspace manager — deux apps indépendantes coordonnées par Docker Compose
