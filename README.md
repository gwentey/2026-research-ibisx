# IBIS-X v2

Plateforme d'accompagnement Machine Learning de bout en bout pour non-experts :
**sélection éthique de datasets** (scoring multi-critères) → **pipeline ML guidé en 9 étapes**
(worker asynchrone) → **explicabilité adaptée au profil** (SHAP/LIME, KPI de qualité, LLM, chat).

Issu d'un projet de recherche (M2 MIAGE, Université Paris 1 Panthéon-Sorbonne). Refonte
complète de la v1 — voir [docs/refonte/](docs/refonte/) (cahier des charges, architecture,
rétro-analyse) et [JALONS.md](JALONS.md) (plan de développement J0 → J9).

## Démarrage rapide

Prérequis : Docker (avec Compose v2). **Aucune clé externe requise** (le LLM passe en repli
déterministe marqué `is_fallback` sans clé OpenRouter — P2).

```bash
cp .env.example .env               # puis générer JWT_SECRET + INITIAL_ADMIN_* (cf. commentaires)
docker compose up -d               # web + api + worker + postgres + redis
docker compose exec api ibis seed  # admin + 6 datasets embarqués (idempotent, JAMAIS auto)
```

- Frontend : http://localhost:3000
- État du système (santé + démo temps réel SSE) : http://localhost:3000/status
- API docs : http://localhost:8000/api/v1/docs

Les migrations s'appliquent automatiquement au démarrage de l'API.
Script de démonstration complet (20 min, persona enseignant) : [docs/demo-20min.md](docs/demo-20min.md).

### Import Kaggle complet (optionnel)

Le seed embarque 6 datasets réels. Pour le catalogue étendu (CDC §5.5.a), renseigner
`KAGGLE_USERNAME`/`KAGGLE_KEY` dans `.env` puis :

```bash
docker compose exec api ibis import-kaggle           # toutes les entrées du YAML
docker compose exec api ibis import-kaggle --only adult-census   # ou ciblé
```

Toute erreur d'import est visible et loggée ([NE PAS REPRODUIRE] S4 : jamais de `return False` silencieux).

## Production

Profil mono-machine derrière **Caddy** (TLS automatique, en-têtes de sécurité, ports internes fermés) :

```bash
IBIS_DOMAIN=mondomaine.fr docker compose -f compose.prod.yml up -d --build
```

Guide pas-à-pas (VPS, secrets, sauvegardes, rotation des clés) : [docs/deploiement-vps.md](docs/deploiement-vps.md).

## Tests

```bash
cd apps/api && uv run pytest -q          # 169 tests backend (RBAC, déterminisme, worker réel)
cd apps/web && pnpm test                 # vitest (parité i18n FR/EN)
cd apps/web && pnpm e2e                  # parcours mission complet FR+EN (stack compose requise + seed)
```

Le parcours mission (inscription → onboarding → projet → wizard 9 étapes → entraînement →
SHAP → chat) est le test d'acceptation final, exécuté chaque nuit en CI (`e2e.yml`).

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
