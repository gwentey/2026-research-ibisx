# IBIS-X

**Plateforme d'accompagnement Machine Learning de bout en bout pour non-experts.**
Du choix éthique d'un jeu de données jusqu'à l'explication d'un modèle — sans écrire une ligne de code.

> Issu d'un projet de recherche (M2 MIAGE, Université Paris 1 Panthéon-Sorbonne).

---

## Pourquoi

Un·e étudiant·e ou un·e chercheur·se doit pouvoir obtenir un **vrai** résultat de Machine Learning
**reproductible et compris**, sans expertise technique. IBIS-X guide de bout en bout et reste
**honnête sur ce qu'il sait** : jamais de donnée inventée, jamais un chiffre non mesuré, et un repli
explicitement marqué quand l'IA générative n'est pas disponible.

## Fonctionnalités

- **Sélection éthique de datasets** — scoring multi-critères pondéré, honnêteté *tristate*
  (vrai / faux / non renseigné, jamais inventé).
- **Pipeline ML guidé en 9 étapes** — nettoyage, split stratifié, préparation, algorithme,
  hyperparamètres, entraînement réel via un worker asynchrone (Celery), reproductible (`random_state=42`).
- **Explicabilité adaptée au profil** — SHAP & LIME (global + local), importance des variables,
  arbre lisible, et des **KPI de fiabilité mesurés** (complétude, stabilité inter-seeds, parcimonie).
- **Copilote d'explication** — un chat XAI ancré en bas de l'écran qui répond en **blocs riches**
  (tableaux, points clés, couleurs sémantiques), ancré sur les vrais chiffres, avec repli déterministe.
- **Regards métier** — sur la page de résultats, une bascule *« Classique ⇄ à travers les yeux de … »*
  relit les **mêmes vrais chiffres** à travers 6 disciplines SHS (économiste, juriste, politiste,
  sociologue, historien, éthicien IA), chacune avec son angle mort.
- **Garde-fou honnête** — un rappel *« association ≠ causalité »* accompagne l'importance des variables.
- **Défis** — missions guidées, gamifiées mais crédibles, pour réussir une première enquête de données réelle.
- **Import de ses propres données** — upload CSV, profilage et scoring éthique automatiques ;
  modèle entraîné **téléchargeable** (`.joblib`, reproductible).

## Démarrage rapide

Prérequis : Docker (avec Compose v2). **Aucune clé externe requise** — sans clé OpenRouter, les textes
IA passent en repli déterministe explicitement marqué.

```bash
cp .env.example .env               # puis générer JWT_SECRET + INITIAL_ADMIN_* (cf. commentaires)
docker compose up -d               # web + api + worker + postgres + redis
docker compose exec api ibis seed  # admin + datasets embarqués (idempotent, JAMAIS auto)
```

- Frontend : http://localhost:3000
- État du système (santé + démo temps réel SSE) : http://localhost:3000/status
- API docs : http://localhost:8000/api/v1/docs

Les migrations s'appliquent automatiquement au démarrage de l'API.

### Import Kaggle complet (optionnel)

Le seed embarque des datasets réels. Pour le catalogue étendu, renseigner `KAGGLE_USERNAME`/`KAGGLE_KEY`
dans `.env` puis :

```bash
docker compose exec api ibis import-kaggle                     # toutes les entrées du YAML
docker compose exec api ibis import-kaggle --only adult-census # ou ciblé
```

## Stack

| Couche | Technologie |
|---|---|
| Frontend | Next.js 16 (design system : template shadcn-ui-kit, conservé tel quel) |
| Backend | FastAPI (monolithe modulaire) + worker Celery — même image Docker |
| Données | PostgreSQL 16, Redis 7 |
| ML / XAI | scikit-learn, SHAP, LIME |
| Infra | Docker Compose (dev) · Caddy + TLS automatique (prod) |

Le front ne code **jamais** un appel `fetch` à la main : il consomme un client TypeScript généré depuis
le contrat OpenAPI.

## Production

Profil mono-machine derrière **Caddy** (TLS automatique, en-têtes de sécurité, ports internes fermés) :

```bash
IBIS_DOMAIN=mondomaine.fr docker compose -f compose.prod.yml up -d --build
```

Guide pas-à-pas (VPS, secrets, sauvegardes, rotation des clés) : [`docs/deploiement-vps.md`](docs/deploiement-vps.md).

## Tests

```bash
cd apps/api && uv run pytest -q     # tests backend (RBAC, déterminisme, worker réel, blocs XAI)
cd apps/web && pnpm test            # vitest (parité i18n FR/EN, logique pure)
cd apps/web && pnpm e2e             # parcours complet FR+EN (stack compose requise + seed)
```

Le parcours complet (inscription → onboarding → projet → wizard 9 étapes → entraînement → SHAP → chat)
est le test d'acceptation final, exécuté en CI.

## Documentation

- [`docs/adr/`](docs/adr/) — décisions d'architecture (ADR-001 → ADR-007).
- [`docs/audit-valeur-recherche.md`](docs/audit-valeur-recherche.md) — audit de la valeur pour la recherche SHS + feuille de route.
- [`docs/demo-20min.md`](docs/demo-20min.md) — script de démonstration (persona enseignant).

## Principes non négociables

1. Jamais de donnée inventée présentée comme réelle.
2. IA honnête (repli explicitement marqué).
3. Une seule source de vérité.
4. Reproductibilité (`random_state=42`).
5. Orientation permanente de l'utilisateur.
6. Un seul langage graphique.
7. Maintenable par un·e seul·e développeur·se.

## Licence

[MIT](LICENSE).
