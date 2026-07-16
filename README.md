# IBIS-X v2

Plateforme d'accompagnement Machine Learning de bout en bout pour non-experts :
**sélection éthique de datasets** (scoring multi-critères) → **pipeline ML guidé en 9 étapes**
(worker asynchrone) → **explicabilité adaptée au profil** (SHAP/LIME, KPI de qualité, LLM, chat).

Issu d'un projet de recherche (M2 MIAGE, Université Paris 1 Panthéon-Sorbonne). Refonte
complète de la v1 — voir [docs/refonte/](docs/refonte/) (cahier des charges, architecture,
rétro-analyse) et [JALONS.md](JALONS.md) (plan de développement J0 → J9).

## Démarrage rapide

Prérequis : Docker (avec Compose v2).

```bash
cp .env.example .env               # puis générer JWT_SECRET (cf. commentaires du fichier)
docker compose up -d               # web + api + worker + postgres + redis
```

- Frontend : http://localhost:3000
- État du système (santé + démo temps réel SSE) : http://localhost:3000/status
- API docs : http://localhost:8000/api/v1/docs

Les migrations s'appliquent automatiquement au démarrage de l'API.

## Développement

### Backend (`apps/api`) — Python 3.12, FastAPI, Celery

```bash
cd apps/api
uv sync                            # installe l'environnement
uv run ruff check . && uv run mypy ibis
docker compose up -d postgres redis   # requis par les tests d'intégration
uv run pytest -q
```

### Frontend (`apps/web`) — Next.js 16, template shadcn-ui-kit-dashboard

```bash
cd apps/web
pnpm install
pnpm dev                           # http://localhost:3000 (API attendue sur :8000)
pnpm lint && pnpm typecheck && pnpm test
```

### Contrat OpenAPI → client TypeScript (ADR-007)

Le front n'écrit **jamais** un appel `fetch` à la main : il consomme le client généré
dans `apps/web/lib/api/generated`. Après toute modification d'endpoint backend :

```bash
cd apps/api && uv run python -m ibis.export_openapi ../web/lib/api/openapi.json
cd ../web && pnpm generate:api
```

La CI (job `contract`) échoue si le client commité n'est pas à jour.

## Organisation

```
apps/web    Next.js 16 (design system : template shadcn-ui-kit, conservé tel quel)
apps/api    FastAPI monolithe modulaire + worker Celery (même image Docker)
docs/adr    Décisions d'architecture ADR-001 → ADR-007
docs/refonte  Cahier des charges, architecture, rétro-analyse v1 (sources de vérité)
JALONS.md   Plan de développement en 10 jalons
```

Principes non négociables **P1–P7** (CDC §1.4) : jamais de donnée inventée non signalée,
IA honnête (`is_fallback`), une seule source de vérité, reproductibilité (`random_state=42`),
orientation permanente, un seul langage graphique, maintenable par un seul dev.
