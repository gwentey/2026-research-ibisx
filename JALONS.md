# JALONS.md — Plan de développement IBIS-X v2

> **Version** : 1.0 — 16 juillet 2026
> **Sources de vérité** : [docs/refonte/01-CAHIER-DES-CHARGES.md](docs/refonte/01-CAHIER-DES-CHARGES.md) (« CDC »), [docs/refonte/02-ARCHITECTURE.md](docs/refonte/02-ARCHITECTURE.md) (« ARCH »), [docs/refonte/retro-analyse/](docs/refonte/retro-analyse/) (6 rapports v1, pièges [NE PAS REPRODUIRE]).
> **Statut** : à valider avant toute ligne de code.

Découpage du cahier des charges en **10 jalons** (J0 → J9). Chaque jalon est **livrable et démontrable seul** : à sa clôture, `docker compose up` démarre une application fonctionnelle, la CI est verte, et une démo scriptée du périmètre du jalon est possible.

---

## Règles transverses (applicables à TOUS les jalons)

Ces règles ne sont pas répétées dans chaque jalon ; elles font partie de la Definition of Done de chacun.

1. **Les 7 principes P1–P7** (CDC §1.4) priment sur toute décision d'implémentation. En particulier : P1 jamais de donnée inventée non signalée (état vide ou erreur explicite, badge « estimé »), P2 IA honnête (`model_used`, `is_fallback`), P3 une seule source de vérité, P4 reproductibilité (`random_state=42`, température LLM 0).
2. **Design = template `shadcn-ui-kit-dashboard-main` TEL QUEL** (CDC P6, §12.1). Aucune couleur, aucun token, aucun style du kit n'est modifié. On réutilise en priorité ses composants (`sidebar`, `card`, `table`, `tabs`, `dialog`, `sheet`, `slider`, `select`, `badge`, `progress`, `skeleton`, `sonner`, `chart`, `timeline`, `empty`) et ses pages (`(guest)`, `onboarding-flow`, `profile`, `settings`, `users`, `empty-states`, `error`). Les pages démo métier (crypto, hotel, ecommerce…) restent en place comme référence de patterns jusqu'au J9, où les routes inutilisées sont purgées — **sans jamais toucher aux tokens/thème**.
3. **i18n FR/EN dès la première page** (`next-intl`, FR par défaut) : ZÉRO texte en dur dans **nos** composants (CDC §12.1). Dark mode conservé (déjà dans le template, `next-themes`).
4. **Contrat unique** : le front consomme exclusivement le **client TypeScript généré** depuis l'OpenAPI FastAPI (ARCH §5.2). Aucun `fetch` manuel, aucun type d'API redéclaré. La CI échoue si le client généré n'est pas à jour.
5. **Sécurité par défaut** : chaque endpoint d'écriture vérifie rôle + ownership (CDC §3.2) ; secrets uniquement via env (`.env` gitignoré, `.env.example` exhaustif) ; aucune clé v1 réutilisée (toutes compromises — README refonte).
6. **Qualité** : tests écrits au fil du jalon (pas « à la fin du projet ») ; CI GitHub Actions bloquante (ruff + mypy + pytest / eslint + tsc + vitest + build / diff client OpenAPI) ; Conventional Commits ; CHANGELOG tenu ; fichiers ≤ ~400 lignes TSX, ≤ ~500 lignes Python (P7).
7. **États UI systématiques** : skeleton / erreur avec retry / vide avec action, breadcrumbs et fil de mission (P5).
8. **Asynchrone** : aucun calcul lourd dans une requête HTTP — tout passe par le worker Celery, progression en base + Redis pub/sub, SSE + repli polling (ARCH §5.3–5.4).

---

## Vue d'ensemble

| # | Nom | Objectif en une phrase | Dépend de |
|---|---|---|---|
| **J0** | Socle technique | Monorepo + Docker Compose + CI + BDD/migrations + client OpenAPI généré + plomberie jobs/SSE : le squelette complet qui tourne. | — |
| **J1** | M1 — Auth, comptes, RBAC, onboarding | Un utilisateur s'inscrit (email ou Google), fait son onboarding, gère son profil ; les rôles et crédits existent. | J0 |
| **J2** | M2 — Catalogue de datasets | Catalogue richement décrit : listing filtrable, détail 4 onglets, aperçu réel, upload manuel, import Kaggle. | J1 |
| **J3** | M3 — Scoring multi-critères | Scores éthique/technique/popularité + score pondéré 12 critères, décomposition, heatmap comparative. | J2 |
| **J4** | M4 — Projets | Le projet capture besoin + pondérations et produit des recommandations persistées ; conteneur du benchmarking. | J3 |
| **J5** | M5 — Wizard 9 étapes + worker ML | Pipeline d'entraînement guidé de bout en bout, exécuté par le worker, avec résultats riches et benchmarking des expériences. | J4 |
| **J6** | M6 — Explicabilité (XAI) | SHAP/LIME + KPI de qualité calculés + graphes Recharts + explication LLM adaptée + chat, dans la page résultats. | J5 |
| **J7** | M7 — Dashboard & annexes | Dashboard d'accueil réel, liste globale des expériences, landing publique, pages d'état. | J5 (J6 pour activités XAI) |
| **J8** | M8 — Administration | Gestion utilisateurs, datasets, templates éthiques (en base), supervision des jobs. | J2, J5 (J6 pour jobs XAI) |
| **J9** | Finalisation | Seed démontrable en 20 min, e2e parcours mission complet, durcissement sécurité, profil prod. | tous |

Ordre d'exécution : **strictement séquentiel J0 → J9** (chaque module s'appuie sur le précédent ; c'est aussi l'ordre du CDC §13).

---

## Jalon 0 — Socle technique

**Objectif** : mettre en place le squelette complet du monorepo (front + back + worker + BDD + CI + contrat généré) de sorte que tout jalon suivant ne soit « que » du fonctionnel.

### Contenu

**Monorepo & outillage** (ARCH §4)
- `git init` + nouveau dépôt `ibis-x` (README refonte : l'ancien repo v1 reste en lecture seule). Arborescence exacte ARCH §4 : `apps/web`, `apps/api`, `docs/`, `docker-compose.yml`, `.env.example`.
- `apps/web` : bootstrap depuis le template `shadcn-ui-kit-dashboard-main` (copie **intégrale et fidèle** — Next.js 16.0.10, React 19.2.3, Tailwind 4, shadcn/ui, Recharts 2.15.4, TanStack Table, react-hook-form + zod, zustand, next-themes). Ajouts non intrusifs : `next-intl` (FR défaut/EN, structure `messages/fr.json` + `en.json`), proxy dev `rewrites` → `http://api:8000` (ARCH §5.1).
- `apps/api` : Python 3.12 + FastAPI ≥ 0.115 + Pydantic v2 (`extra="forbid"` sur les payloads d'écriture), SQLAlchemy 2 + **une seule chaîne Alembic**, structure modulaire `ibis/` (core, db, modules/, workers/, storage/, cli.py) — ARCH §4.
- `docs/` : les 7 **ADR** formalisés depuis ARCH §14 (ADR-001 stack … ADR-007 temps réel/contrat) — c'est de la copie structurée, les décisions sont déjà tranchées.

**Docker Compose** (ARCH §3, §11)
- 5 conteneurs : `web`, `api`, `worker` (MÊME image que api, commande Celery), `postgres:16-alpine`, `redis:7-alpine` ; volumes `ibis-data` (partagé api+worker), `pg-data`, `redis-data` ; healthchecks ; `mem_limit` worker 4 g.
- Entrypoint api : `alembic upgrade head` (verrou advisory) puis uvicorn — migrations auto au boot (ARCH §6.1).
- `.env.example` exhaustif (ARCH §11) : toutes les variables documentées, aucun secret réel.

**Plomberie transverse** (utilisée par tous les modules suivants)
- `core/` : config pydantic-settings, erreurs typées, logging structuré JSON (structlog, `request_id`/`job_id` corrélés — ARCH §12).
- `storage/` : abstraction `LocalFSStorage` (volume `/data`, défaut) + interface `S3Storage` optionnelle (ARCH §8) ; arborescence `/data/datasets|models|avatars|tmp`.
- **Framework de jobs** : app Celery (queues `training`, `xai`, `llm`, `maintenance`), table `jobs` (supervision), progression en base + publication Redis pub/sub, endpoint **SSE** `GET /api/v1/jobs/{job_id}/events` + repli polling (ARCH §5.3–5.4, §10). Tâche « smoke » de démonstration (progression 0→100) pour prouver la chaîne API → file → worker → SSE → navigateur.
- `GET /api/v1/health` (DB + Redis + volume) et `GET /api/v1/health/worker` (heartbeat Celery) — ARCH §12.

**Contrat OpenAPI → client TS** (ARCH §5.2)
- Génération du client typé dans `apps/web/lib/api/` (openapi-typescript ou orval) + wrapper fetch ; script `pnpm generate:api` ; **check CI** : diff = échec.
- Première consommation réelle : la page d'accueil du template affiche l'état de santé de l'API via le client généré (preuve de bout en bout).

**CI GitHub Actions** (ARCH §12)
- Jobs sur PR : api (ruff, mypy, pytest avec service Postgres), web (eslint, tsc, vitest, build), contrat (client OpenAPI à jour), build des 2 images Docker.
- Squelettes de tests fonctionnels : 1 test unitaire témoin api, 1 test d'intégration API (health), 1 test vitest web, Playwright installé (e2e viendra en J1).

### Dépendances
Aucune.

### Definition of Done
- [ ] `docker compose up` sur machine vierge → 5 conteneurs healthy, migrations appliquées automatiquement.
- [ ] `http://localhost:3000` sert le template (design intact, dark mode et pages démo fonctionnels) ; la page d'accueil affiche le statut API via le **client généré**.
- [ ] `GET /api/v1/health` = 200 (db, redis, volume) ; `GET /api/v1/health/worker` = 200.
- [ ] Tâche smoke : POST de déclenchement → progression visible en SSE dans le navigateur ET par polling.
- [ ] CI verte sur PR (lint, types, tests, build, diff OpenAPI) ; échec prouvé si on modifie un schéma sans régénérer le client.
- [ ] `.env.example` complet ; scan : aucun secret dans le repo ; `.env` gitignoré.
- [ ] ADR-001 → ADR-007 présents dans `docs/adr/`.

### Points de vigilance [NE PAS REPRODUIRE]
- **4 chaînes Alembic parallèles** en v1 (retro 04) → UNE seule chaîne, un seul `Base` SQLAlchemy (retro 01 : double Base).
- **Code copié entre images Docker** (retro 02 : `app/ml/` copié dans l'image xai) → api et worker = même image, mêmes modules.
- **Secrets réels versionnés** (S7, retro 04 : secrets K8s + `.env` committés) → env only ; les clés v1 (OpenRouter/OpenAI, Google, JWT, Kaggle) sont **compromises**, en générer de nouvelles.
- **0 % de tests, aucune CI de qualité** (S9, retro 04 : seul un workflow de deploy existait) → CI bloquante dès J0.
- **Contrats front/back désalignés** (mal n°1 de la v1) → client généré + diff CI dès J0, jamais de fetch manuel.
- **Renommage exai→ibis-x incomplet** (retro 04) → nommage unique `ibis`/`ibis-x` partout dès le départ.
- Pas de gateway, pas de headers `X-User-ID` forgeables (retro 04) : l'API vérifie elle-même ses JWT dès J1.

---

## Jalon 1 — M1 : Authentification, comptes, RBAC, onboarding

**Objectif** : un utilisateur peut s'inscrire (email/mdp ou Google), se connecter, compléter l'onboarding obligatoire, gérer son profil ; les rôles, quotas et crédits existent et sont appliqués.

### Contenu

**Backend auth** (CDC §4.1 ; ARCH §7)
- Tables `users`, `refresh_tokens`, `password_reset_tokens`, `oauth_identities` (ARCH §6.2, `hashed_password NULL` pour comptes Google-only, `credits` défaut **100**).
- Auth maison ~300 lignes : `pyjwt` + `argon2-cffi` (Argon2id). Access JWT HS256 30 min (claims `sub`, `role`, `exp`, `iat`, `jti`), stocké **en mémoire** côté front. Refresh opaque 256 bits haché en base, 7 jours, **rotation à chaque usage** + détection de réutilisation → révocation de la famille ; cookie `httpOnly Secure SameSite=Lax` sur `/api/v1/auth` (ARCH §7.1).
- Endpoints : register (auto-login), login, refresh, logout, forgot-password / reset-password (SMTP configurable, lien loggé en dev [SHOULD]).
- **Google OIDC direct** (authlib, PKCE + state, aucun IDP tiers) : authorize → callback front → exchange ; validation signature `id_token` + `email_verified` ; liaison par email vérifié à un compte existant sinon création ; émission de NOS JWT ; aucun token Google conservé (CDC §4.1 ; ARCH §7.1).
- Rate limiting `/auth/*` (10/min/IP, slowapi + Redis).
- RBAC : dépendances FastAPI `CurrentUser`, `require_role(...)`, `require_owner_or_admin(...)` (ARCH §7.2) ; rôles `user`/`contributor`/`admin` (CDC §3.1–3.2).
- Quotas & crédits — socle (CDC §3.3) : champ `credits` (défaut 100), valeurs de quotas **configurables par env** (`MAX_CONCURRENT_TRAININGS=3`, `MAX_DAILY_TRAININGS=20`, `DEFAULT_CREDITS=100`, `MAX_CHAT_QUESTIONS=5`) ; les débits réels arrivent en J5/J6.
- CLI `ibis create-admin <email>` + `INITIAL_ADMIN_EMAIL/PASSWORD` au premier boot (CDC §11 ; ARCH §7.2).

**Frontend** (CDC §4.2)
- Pages `(guest)` du template : login, register, forgot-password, avec bouton « Continuer avec Google » (séparateur « ou »). Callback `/auth/google/callback`.
- **Onboarding obligatoire** plein écran (base `onboarding-flow` du template) : `education_level`, `age` (13–120), `ai_familiarity` (1–5) ; redirection forcée tant que non complété ; dérivation `xai_audience` (1–2 novice, 3 intermediate, 4–5 expert) — CDC §4.1.
- Profil (base `pages/profile` + `settings`, onglets Profil / Sécurité / Préférences / Crédits) : pseudo, avatar (upload → `/data/avatars`, servi par endpoint authentifié), prénom/nom, langue ; changement de mdp (avec mdp actuel) ; définir un mdp pour compte Google-only ; suppression de compte (confirmation par saisie de l'email, cascade).
- Layout applicatif `(app)` : sidebar du template avec nos entrées (Dashboard, Datasets, Projets, Expériences), topbar (langue FR/EN, dark mode, solde de crédits, menu profil), garde d'auth + garde d'onboarding. Accueil provisoire minimal (le vrai dashboard = J7).

### Dépendances
J0 (compose, migrations, client généré, storage pour avatars).

### Definition of Done
- [ ] Parcours complet démontrable : inscription → auto-login → onboarding forcé → app ; logout ; re-login ; refresh silencieux après 30 min ; reset de mot de passe (lien loggé en dev).
- [ ] « Continuer avec Google » fonctionne (nouveau compte ET liaison à un compte email existant) ; le compte Google-only passe l'onboarding ; aucun token Google en base.
- [ ] Tests unitaires : hash Argon2id, émission/validation JWT, rotation refresh, **réutilisation d'un refresh révoqué → révocation famille**, dérivation `xai_audience`.
- [ ] Tests d'intégration : la **matrice RBAC complète du CDC §3.2** (chaque capacité × chaque rôle → 200/403), redirection onboarding, suppression de compte en cascade, rate limiting auth (429).
- [ ] E2E Playwright : inscription → onboarding → arrivée dans l'app (FR et EN, clair et sombre).
- [ ] `ibis create-admin` opérationnel.

### Points de vigilance [NE PAS REPRODUIRE]
- **S1/S2** : endpoints d'écriture/admin v1 **sans contrôle de rôle ni d'ownership** → chaque route testée par la matrice §3.2 dès ce jalon.
- **fastapi-users** (retro 04 : « trop de magie », migrations subies) → implémentation directe assumée.
- **JWT 8 h sans refresh, stocké en localStorage** (retro 04/05) → access 30 min en mémoire + refresh httpOnly rotation.
- **bcrypt** v1 → Argon2id.
- **`/admin/temporary-grant`** (endpoint public de promotion, retro 04) → interdit ; premier admin par CLI/env uniquement.
- **`oauth_account` v1 stockait les access/refresh tokens Google** → on ne stocke que (provider, subject, email).
- **Rôle relu en base à chaque requête** (retro 04 : pas de claims custom) → rôle en claim JWT ; les actions admin critiques revérifient en base (ARCH §7.2).
- **Crédits défaut 10 + `date_claim`** v1 → défaut 100, recharge admin (M8), pas de « claim » périodique.
- **Quotas en dur** (retro 02 : `GET /users/quotas` hardcodé) → tout par env.

---

## Jalon 2 — M2 : Catalogue de datasets, filtration, ingestion

**Objectif** : un catalogue de datasets richement décrits (métadonnées techniques + éthiques tristate) que l'on peut explorer, filtrer finement côté backend, prévisualiser réellement, uploader (contributor+) et seeder depuis Kaggle.

### Contenu

**Modèle & backend** (CDC §5.2 ; ARCH §6.2)
- Tables `datasets` (dont `domain TEXT[]`/`task TEXT[]` + index **GIN**, 10 critères éthiques `BOOLEAN NULL` tristate), `dataset_files`, `dataset_columns` (stats JSONB assainies — sanitizer NaN/Inf unique), `ethical_templates` (structure posée, CRUD admin en J8), `quality_analyses` (structure posée, remplie en J5).
- `GET /datasets` : filtres exhaustifs du CDC §5.3 (texte ILIKE/pg_trgm, containment ARRAY `@>`, plages, tristate éthiques, toggles), tri 7 clés, pagination serveur 12/24/48/96 ; `GET /datasets/facets` (domaines, tâches, bornes) ; `GET /datasets/stats` ; détail, preview, similar, files, download (streaming authentifié) — CDC §5.6.
- **Aperçu réel** : échantillon 50 lignes (`random_state=42`), max 20 colonnes, stats par colonne calculées sur le fichier complet ; fichier inaccessible → **erreur explicite** (CDC §5.4.3).
- Datasets similaires : même domaine+tâche > domaine > tâche > taille ±50 % (CDC §5.4.1).
- **Module `llm` v1** (ARCH §9.3) : client **unique** OpenRouter (`OPENROUTER_API_KEY`, `LLM_MODEL`, température 0, timeout, file `llm`) + framework de fallback déterministe `is_fallback: true`. Premier consommateur : **Guide IA** du dataset (job asynchrone, sortie `model_used`, P2) — CDC §5.4.4.

**Frontend** (CDC §5.3–5.4)
- `/datasets` : grille de cartes (défaut) + vue table (TanStack), recherche debounce 300 ms, tri, pagination, **panneau de filtres unique** (Sheet shadcn) avec compteur temps réel, chips supprimables + « Tout effacer », 4 états UI.
- `/datasets/[id]` : header (badges, métriques, actions selon rôle) + 4 onglets : Vue d'ensemble (grille éthique tristate ✓/✗/—, métriques **réelles uniquement**, similaires), Fichiers & structure (colonnes, badge PII), Aperçu (réel), Guide IA (async, badge modèle/fallback).

**Ingestion** (CDC §5.5)
- **Upload manuel** (contributor+) : assistant 3 étapes — dépôt (CSV/XLSX/JSON/Parquet, 100 MB max, drag & drop) → `POST /datasets/preview` analyse **sans persistance** (aperçu 10 lignes, types, % manquants, suggestions domaines/tâches/nom) → formulaire de métadonnées pré-rempli (tristate défaut `null`). Validation : conversion **Parquet Snappy**, noms de stockage UUID, agrégats (`instances_number`, `features_number`, `global_missing_percentage` pondérée).
- **Détection PII** réelle à l'analyse (heuristique nom de colonne + regex sur échantillon), **persistée** dans `is_pii`.
- **Import Kaggle** : CLI `ibis import-kaggle` pilotée par YAML (~30 datasets, CDC §5.5.a), pipeline download → analyse → Parquet → storage → **écriture via la couche service interne** ; métadonnées enrichies par JSON versionnés validés par JSON Schema ; fallback template éthique du domaine sinon `null` ; idempotent, relançable, exécutable dans le worker.
- **Complétion de métadonnées** : page taux de complétude + formulaire par sections (critères sensibles marqués « à valider par un humain »).

### Dépendances
J1 (auth/RBAC pour les droits d'upload et endpoints authentifiés), J0 (storage, jobs/SSE pour le Guide IA).

### Definition of Done
- [ ] Démo : catalogue seedé (≥ 5 datasets importés via la CLI sur fixtures locales), filtres combinés + chips + compteur temps réel, détail 4 onglets avec aperçu réel, upload manuel complet par un contributor, guide IA généré (ou fallback marqué si pas de clé).
- [ ] Tests unitaires : interprétation des types de colonnes, heuristique PII, agrégats pondérés, sanitizer JSONB, suggestions d'upload.
- [ ] Tests d'intégration : chaque famille de filtres (containment TOUS les domaines cochés, plages, tristate = true seulement, toggles), tri + pagination, `user` → 403 sur POST /datasets, `contributor` → 201 puis PUT/DELETE sur SON dataset seulement, aperçu réel depuis Parquet, fichier absent → erreur explicite (pas de fallback).
- [ ] Import Kaggle : test d'idempotence (2ᵉ run = skip) sur fixtures locales sans réseau ; validation JSON Schema des métadonnées enrichies.
- [ ] Perf : catalogue paginé < 300 ms sur 60 datasets (CDC §12.2).

### Points de vigilance [NE PAS REPRODUIRE]
- **Métriques simulées présentées comme réelles** (retro 01 : consistency/accuracy/outliers/pii_risk **aléatoires**, distribution_analysis fictive) → supprimées ; on n'affiche QUE ce qu'on calcule (P1).
- **Aperçu de secours simulé** (retro 01 : fallback `is_fallback` silencieux à l'affichage) → état d'erreur explicite.
- **Deux panneaux de filtres concurrents** (retro 05) → un seul (P3).
- **Score éthique recalculé en SQL inline** (retro 01 : duplication Python/SQL) → une seule implémentation, réutilisée par le filtre `ethical_score_min` (préparée pour J3).
- **`is_pii` jamais calculé** (retro 01 : TODO) → heuristique réelle et persistée.
- **Import Kaggle en écriture DB directe** (retro 01 : bypass API) → passe par la couche service interne.
- **Code mort** (retro 01 : router jamais monté, tables `dataset_relationships` jamais alimentées) → ne créer NI table NI endpoint non consommés.
- **Lecture/preview/download sans auth ; upload ouvert à tous** (retro 01) → tout authentifié, upload contributor+.
- **main.py 4 105 lignes** (retro 01) → module `datasets` découpé (routes/service/modèles/filtres).
- **AUTO_INIT_DATA au démarrage de l'API** (retro 01) → le seed est une commande explicite (CLI/worker), pas un effet de bord du boot.

---

## Jalon 3 — M3 : Scoring multi-critères et heatmap

**Objectif** : transformer le choix d'un dataset en décision assistée et transparente — scores exacts calculés à UN endroit, pondération utilisateur, décomposition affichée, heatmap comparative.

### Contenu

**Module `scoring` pur** (CDC §6.2–6.3 ; ARCH §4) — fonctions pures, sans I/O, testées unitairement :
- **Score éthique** = (nb critères TRUE) / 10 (`null`/`false` = 0).
- **Score technique** = somme pondérée **normalisée dynamiquement** sur les critères renseignés (poids 0.15/0.15/0.20/0.20/0.15/0.15 ; formules log et optimum 10–100 features exactes du CDC §6.2).
- **Score popularité** = `clamp(log10(citations)/3, 0, 1)`.
- **Score final** = `Σ(score_i × poids_i) / Σ(poids_i)` sur les **12 critères scorables** (table CDC §6.3, y compris `sample_balance` [SHOULD] et `year` `(year−2000)/25`) ; poids par défaut éthique 0.4 / technique 0.4 / popularité 0.2 ; décomposition `criterion_scores` dans chaque réponse.
- `POST /api/v1/datasets/score` (filters? + weights) → liste triée {dataset, score, rank, criterion_scores} ; `GET /api/v1/score/profiles` : `Recherche académique`, `Application industrielle`, `Prototypage rapide` (CDC §6.5).
- Le filtre catalogue `ethical_score_min` (J2) est rebranché sur CE module (une seule définition du score éthique, P3).

**Frontend** (CDC §6.4)
- **Panneau de pondération** : slider 0→1 pas 0.05 par critère activé, % effectif normalisé affiché, profils prédéfinis en un clic, réinitialiser.
- **Résultats classés** : rang, score % coloré (≥80 vert, ≥60 lime, ≥40 ambre, <40 rouge), tooltip de décomposition par critère.
- **Heatmap de comparaison** (marqueur différenciant) : datasets × 12 critères, cellules colorées par sous-score, rendu **Recharts/DOM natif**, tri par colonne, clic cellule → détail dataset.
- Entrée « exploration libre » depuis le catalogue : « Scorer cette sélection » (les entrées projet arrivent en J4).

### Dépendances
J2 (datasets et leurs métadonnées).

### Definition of Done
- [ ] Démo : depuis le catalogue, sélectionner des datasets → panneau de pondération → classement + décomposition + heatmap interactive ; appliquer un profil prédéfini change le classement en direct.
- [ ] Tests unitaires **exhaustifs** des formules avec valeurs attendues calculées à la main (golden tests) : cas tristate (null exclu du technique mais = 0 en éthique), bornes log (100 lignes → 0, 100 000 → 1 ; 1 000 citations → 1), optimum features (10–100 → 1, dégressifs), normalisation dynamique, poids par défaut, Σ poids > 1 normalisée, décomposition = somme cohérente.
- [ ] Test d'intégration : POST /datasets/score avec filtres + poids → classement stable et reproductible ; le filtre `ethical_score_min` du catalogue donne le même score que la décomposition.
- [ ] Perf : scoring de 100 datasets avec décomposition < 1 s (CDC §12.2).

### Points de vigilance [NE PAS REPRODUIRE]
- **3 implémentations divergentes du scoring** (audit P2, retro 06) → LE module `scoring` backend est l'unique source ; le front ne recalcule JAMAIS un score (P3) — la heatmap consomme `criterion_scores` tel quel.
- **Duplication Python vs SQL** du score éthique (retro 01) → une définition, deux usages.
- **Heatmap ECharts** v1 → Recharts/DOM natif du kit (CDC §6.4, P6).
- La v1 divisait `year` par 24 (retro 01) et le CDC v2 fixe **/25** → suivre le CDC.

---

## Jalon 4 — M4 : Projets

**Objectif** : le projet capture le besoin (critères + pondérations), produit des recommandations persistées et devient le conteneur des expériences ; le fil de mission est en place.

### Contenu

**Backend** (CDC §7.2–7.3 ; ARCH §6.2)
- Table `projects` (criteria JSONB au format des filtres, weights JSONB) ; **isolation stricte par `user_id`** sur toutes les routes.
- CRUD + liste paginée avec recherche (nom + description) ; normalisation automatique des poids si Σ > 1.
- `GET /projects/{id}/recommendations` : compose filtres du projet + module scoring (J3).
- `GET /projects/{id}/experiments` : structure posée (table `experiments` minimale avec statut `draft`), vivante en J5.
- `POST /experiments/compare` : contrat posé (implémentation complète J5).

**Frontend** (CDC §7.2)
- Liste des projets : cartes (nom, description, date, nb critères, nb expériences, meilleur score), recherche, pagination.
- **Création/édition en 3 étapes** (stepper) : Informations → Critères (mêmes contrôles que les filtres du catalogue) → Pondérations (panneau J3) ; **aperçu temps réel** des recommandations (top 3 + compteur, debounce 500 ms).
- **Page projet 3 onglets** : ① Recommandations (classement complet + heatmap, actions Voir / « Lancer un entraînement » — bouton présent, câblé vers le wizard en J5) ; ② Expériences (table avec **empty state** propre « Aucune expérience — lancez votre premier entraînement » ; contenu réel en J5) ; ③ Configuration (critères + poids lisibles + modifier).
- **Fil de mission** (P5) : composant `mission-stepper` Projet → Dataset → Entraînement → Explication, visible sur le parcours ; breadcrumbs.
- Entrée scoring n°① et ② du CDC §6.4 (formulaire projet + page projet) désormais actives.

### Dépendances
J3 (scoring/heatmap), J1 (isolation par utilisateur).

### Definition of Done
- [ ] Démo : créer un projet en 3 étapes avec aperçu temps réel → page projet avec recommandations persistées + heatmap → modifier les pondérations → le classement change.
- [ ] Tests d'intégration : isolation stricte (user A ne voit/modifie JAMAIS un projet de user B → 404/403), normalisation Σ poids > 1, recommandations = mêmes scores que POST /datasets/score à poids égaux (cohérence P3), recherche + pagination.
- [ ] Tests unitaires : validation des critères JSONB (schéma strict), fusion critères/poids par défaut.
- [ ] E2E Playwright : création de projet complète (3 étapes) → recommandations affichées.

### Points de vigilance [NE PAS REPRODUIRE]
- **Deux parcours concurrents** vers l'entraînement (retro 02/05 : ml-studio 4 étapes + wizard) → l'UNIQUE point d'entrée du wizard est le bouton « Lancer un entraînement » d'un projet, avec `projectId` + `datasetId` (CDC §1.6).
- La v1 avait un onglet « Résumé » et des stats projet partiellement décoratives → chaque chiffre affiché (meilleur score, nb expériences) est calculé ou absent (P1).
- Poids non normalisés incohérents entre front et back (v1 : normalisation seulement au PUT) → règle unique backend, testée.

---

## Jalon 5 — M5 : Wizard 9 étapes + worker d'entraînement

**Objectif** : un non-expert conduit un entraînement complet sans erreur méthodologique — 9 étapes canoniques, worker asynchrone honnête, résultats riches, benchmarking des expériences.

### Contenu

**5.A — Analyse qualité & nettoyage (backend)** (CDC §8.2 É3)
- Analyse serveur mise en cache 7 j (`quality_analyses`, invalidable) : par colonne % manquants, type, distribution (normaltest + skewness), uniques, outliers (IQR ±1.5, Z-score 3) ; normalisation des « faux manquants » (`''`, `null`, `N/A`, `missing`…) implémentée à **UN endroit** ; score qualité global 0–100 (pénalités CDC).
- **Vocabulaire canonique unique** des stratégies (P3) : `mean`, `median`, `most_frequent`, `constant`, `knn`, `iterative`, `drop_rows`, `drop_column` — aucun alias, aucune interpolation fantôme.
- Recommandation automatique par colonne (matrice % manquants × type du CDC §8.2 É3).

**5.B — Modules ML (backend, partagés api/worker)** (CDC §8.3 ; ARCH §9.1)
- `modules/ml` : preprocessing (séquence exacte : tokens → drop_column → drop_rows → cible manquante → exclusion colonnes ID → LabelEncoder → split stratifié → `ColumnTransformer` **fit sur train uniquement**), **registre d'algorithmes** (`decision_tree`, `random_forest` : wrapper fit/predict/importances/tree_structure + schéma d'hyperparamètres source du formulaire ET de la validation Pydantic), évaluation (métriques classification dont **F1-macro principale**, ROC/PR, matrice, rapport par classe, OOB ; régression dont **MAE principale**), génération des **données de visualisation JSON** (jamais d'images).
- Ajout d'un algo = 1 fichier + 1 entrée de registre (< 1 jour, extensibilité V2.1).

**5.C — Cycle de vie expérience (backend)** (CDC §8.2 É8, §8.3 ; ARCH §6.2, §10)
- Table `experiments` complète (statuts `draft`→`pending`→`running`→`completed`/`failed`/`cancelled`, progress, error_code, metrics/viz_data/feature_importance JSONB, artifact_key, durées).
- `POST /experiments` : validation stricte (registre, hyperparamètres, preprocessing_config `extra=forbid`), **quotas** (3 simultanés → 429, 20/jour) et **débit de crédits** (1 crédit), mise en file `training`.
- Tâche worker : séquence exacte CDC §8.3 (9 points), jalons de progression 10/30/50/70/90/100 + logs horodatés lisibles (`experiment_logs`), artefact joblib `{model, preprocessing_pipeline, feature_names, training_config}`, timeout dur 2 h, retries techniques ×3, annulation propre (révocation + nettoyage artefacts partiels), détection worker perdu (> 10 min → `WORKER_LOST`), `error_code` typés (`DATASET_UNAVAILABLE`, `CLEANING_CONFIG_INVALID`, `TIMEOUT`…).
- **Contrat d'honnêteté** : le récap post-entraînement expose `applied: true` + détail réel des transformations appliquées (CDC §8.2 É3).
- Endpoints : GET experiment (+ position file), résultats, download modèle (.joblib streaming), cancel, relance ; `POST /experiments/compare` (métriques alignées).

**5.D — Wizard frontend 9 étapes** (CDC §8.1–8.2)
- **Plein écran** hors layout dashboard (`app/wizard/`), stepper horizontal persistant, navigation libre sur étapes validées, **store Zustand unique** (P3) projetant vers le payload API, **brouillon persisté serveur** à chaque étape validée (statut `draft`) → reprise après fermeture (P5).
- Les **9 étapes canoniques** (CDC §8.1), chacune avec sa pédagogie (« Comprendre »), ses recommandations et ses garde-fous :
  1. Aperçu du dataset (contexte `projectId`+`datasetId` obligatoires, score qualité calculé en tâche de fond, aperçu 10 lignes).
  2. Objectif de prédiction (cible recherchable pré-suggérée, tâche ; **assistance IA** : heuristique déterministe locale + enrichissement LLM async marqué P2, bouton « Appliquer la recommandation » ; **alerte bloquante** si cible catégorielle + régression — dialogue explicite, jamais d'auto-correction silencieuse).
  3. Nettoyage (tableau interactif par colonne, stratégies canoniques, « Appliquer les recommandations », **validation bloquante** : colonne > 30 % sans stratégie, cible avec manquants ; cas dataset propre → message anti sur-traitement).
  4. Division (slider 10–50 % défaut 20, visualisation proportions, stratification auto + avertissement classes retirées, `random_state=42` affiché non modifiable).
  5. Préparation finale (normalisation standard/minmax/robust — reco robust si outliers ; encodage onehot/ordinal ; **réellement transmis et appliqué**).
  6. Algorithme (cartes servies par `GET /algorithms`, forces/faiblesses, badges, **recommandation IA bornée au registre**).
  7. Hyperparamètres (3 presets Équilibré/Haute précision/Rapide + personnalisé ; formulaire **généré depuis le schéma API** ; descriptions + alertes de trade-off).
  8. Entraînement (récap complet + coût 1 crédit + confirmation ; **console temps réel SSE** progression + logs, repli polling 2 s ; position dans la file ; annulation).
  9. Résultats → transition auto vers la page résultats.

**5.E — Page résultats (volet performance)** (CDC §8.2 É9)
- Métriques complètes + explication pédagogique de chacune ; score composite en anneau + qualification (tooltip méthode de calcul).
- **Graphes Recharts depuis viz_data JSON** : matrice de confusion (heatmap), ROC (+ AUC + seuil optimal), précision-rappel, importance des features (top 20), **arbre de décision interactif** (JSON ; RF : 1ᵉʳ arbre profondeur ≤ 4 + mention « 1 arbre sur N ») ; régression : prédictions vs réelles, résidus, histogramme des résidus.
- Actions : télécharger .joblib, relancer avec ajustements (wizard pré-rempli), nouvelle expérience, aller à l'explicabilité (placeholder J6).
- Onglet **Expériences du projet** vivant (J4) : table complète + **sélection multi → vue comparative** (tableau aligné + barres groupées Recharts) — LE benchmarking (CDC §7.2).

### Dépendances
J4 (entrée par projet), J2 (datasets/Parquet), J0 (jobs/SSE), J1 (quotas/crédits).

### Definition of Done
- [ ] Démo (persona enseignant) : depuis un projet, wizard complet sur `student_performance` (avec manquants) ET sur `iris` (propre), console temps réel, résultats riches, comparaison de 2 expériences côte à côte ; fermer le navigateur à l'étape 5 puis reprendre le brouillon.
- [ ] Tests unitaires : **chaque stratégie de nettoyage réellement appliquée** (8 stratégies × vérification des valeurs), tokens de manquants, matrice de recommandation, outliers IQR/Z, score qualité, split stratifié (+ classes à 1 exemplaire retirées + avertissement), chaque métrique (valeurs attendues), structure d'arbre JSON, validation des hyperparamètres par le registre (clé inconnue → rejet).
- [ ] Tests d'intégration : cycle complet `pending→running→completed` sur mini-dataset embarqué (métriques + viz_data + artefact présents + `applied: true` avec détail conforme à la config), config de nettoyage **volontairement fantaisiste → CLEANING_CONFIG_INVALID**, dataset supprimé → `DATASET_UNAVAILABLE`, annulation → `cancelled` + artefacts nettoyés, 4ᵉ entraînement simultané → 429, crédits débités, brouillon repris.
- [ ] **Test e2e de déterminisme** : deux exécutions de la même config → métriques et feature importance **strictement identiques** (P4).
- [ ] E2E Playwright : wizard 9 étapes complet sur iris → résultats affichés.
- [ ] Perf : entraînement dataset seed < 2 min ; l'API ne bloque jamais (tout en file).

### Points de vigilance [NE PAS REPRODUIRE]
- **T1 — la config de nettoyage était IGNORÉE à l'entraînement** (le pire mensonge de la v1) → contrat d'honnêteté testé bout en bout (config → transformations vérifiées).
- **T2 — 3 stratégies sur 5 crashaient** → les 8 canoniques ont chacune un test d'application réelle.
- **T3 — scaling toujours appliqué, méthode ignorée** → config transmise et appliquée, testée.
- **T6 — entraînement de secours sur données synthétiques** → JAMAIS ; échec explicite (P1).
- **T8 — l'IA recommandait XGBoost/SVM non entraînables** (clampé silencieusement) → recommandation bornée au registre.
- **3 référentiels d'étapes contradictoires** (9 marketing / 9 dont 2 masquées / 6 refondues — retro 02) → LES 9 canoniques du CDC §8.1, ni plus ni moins.
- **Interpolations linear/spline/ffill silencieusement remplacées par median** (retro 02) → vocabulaire fermé, erreur si stratégie inconnue.
- **Auto-correction silencieuse du task_type** (retro 02) → dialogue explicite bloquant (É2).
- **CV affichée mais jamais exécutée** (retro 02) → k-fold reporté [V2.1] ; on ne montre QUE ce qui tourne.
- **PNG matplotlib base64 en BDD** (retro 02) → viz_data JSON + Recharts exclusivement.
- **Wizard monolithe 4 301 lignes, 9 étapes visuelles vs 6 logiques** (retro 05) → un composant par étape ≤ 400 lignes, store unique aligné sur les 9 étapes.
- **Polling partout** (retro 05) → SSE d'abord, polling en repli.
- **Quotas en dur** (retro 02 : 5 simultanés) → env (`MAX_CONCURRENT_TRAININGS=3`).
- **P1 v1 : assistant IA en `setTimeout` + texte en dur** → heuristique réelle + LLM marqué, sinon rien.

---

## Jalon 6 — M6 : Explicabilité (XAI)

**Objectif** : des explications fiables, reproductibles et adaptées au profil, avec des KPI de qualité réellement calculés — intégrées à la page de résultats (pas de dashboard séparé).

### Contenu

**6.A — Moteur XAI (worker, queue `xai`)** (CDC §9.2 ; ARCH §9.1–9.2)
- `modules/xai` : **SHAP TreeExplainer** (défaut DT/RF), KernelExplainer (repli non-arbres, background `shap.sample(100, random_state=42)`), **LIME Tabular** (`discretize_continuous=true`, `random_state=42`, 10 features, num_samples réellement transmis), **importance native Gini** toujours disponible et TOUJOURS étiquetée « Importance du modèle » (P2).
- Sélection `auto` justifiée (affichage du pourquoi) ou choix explicite.
- **Globale** : moyenne |SHAP| sur échantillon n=100 seedé ; multiclasse `mean_abs` tracée en métadonnées. **Locale** : contributions d'UNE prédiction ; **sélection d'instance côté serveur** — `GET /experiments/{id}/test-instances` (tableau paginé préd/réel, tri par erreur). LIME globale = agrégation de 50 locales, étiquetée comme telle.
- Table `explanations` (ARCH §6.2) : method_requested/used, audience_level, language, values, quality_kpis, viz_data, text_explanation, model_used, is_fallback, processing_seconds, seeds/politiques en métadonnées.

**6.B — KPI de qualité** (CDC §9.3 ; ARCH §9.2) — `modules/xai/quality.py`, fonctions pures :
- Fidélité locale LIME (R², stockée ET exposée), complétude SHAP (axiome d'efficience < 1 %), stabilité (Spearman moyen sur 5 ré-échantillonnages seeds 42–46), accord inter-méthodes SHAP↔LIME [SHOULD], parcimonie (k features pour 80 %), temps de calcul **mesuré**.
- Bandeau « Fiabilité de l'explication » avec seuils colorés et pédagogie ; **KPI non calculable → absent** (P1).

**6.C — Graphes XAI** (CDC §9.4) — viz_data JSON → Recharts : importance globale (top 15), beeswarm simplifié [SHOULD], **waterfall local** (barres signées, valeurs d'instance annotées), comparaison SHAP vs LIME [SHOULD], historique des explications.

**6.D — Explication textuelle LLM adaptative** (CDC §9.5)
- Adaptée au profil (`novice` analogies ~180 mots / `intermediate` ~250 / `expert` ~320) et à la langue UI ; température 0 ; prompt = exclusivement les vraies valeurs ; **post-validation anti-hallucination** (tout nombre cité doit exister dans le contexte, sinon régénération puis fallback) ; sortie `model_used` + `tokens_used` ; panne LLM → **template déterministe** sur vraies données, badge « généré sans IA ».

**6.E — Chat XAI** (CDC §9.6)
- Sessions liées à une explication : max 5 questions (env), 500 caractères, expiration 24 h (tâche beat) ; contexte = métriques réelles + top features + profil + 10 derniers messages ; **totalement asynchrone** (job queue `llm` + SSE/polling) ; questions suggérées contextuelles en chips.

**6.F — Intégration UI** : onglet **Explicabilité** de la page résultats (demande d'explication globale/locale avec choix de méthode justifié, sélection d'instance dans le tableau test, KPI, graphes, texte adaptatif, chat, historique). Débit crédits : 1 par explication LLM (CDC §3.3).

### Dépendances
J5 (expériences, artefacts joblib, page résultats), J2 (module llm), J1 (profil/xai_audience).

### Definition of Done
- [ ] Démo : sur une expérience terminée — explication globale SHAP avec KPI + graphes + texte adapté (novice vs expert = textes différents), explication locale d'une instance mal classée choisie dans le tableau serveur, chat 5 questions, historique.
- [ ] Tests unitaires : chaque KPI sur cas construits (complétude vraie/violée, stabilité parfaite/dégradée, parcimonie, fidélité, accord), post-validation anti-hallucination (nombre inventé détecté), templates de fallback.
- [ ] Tests d'intégration : cycle explication globale ET locale sur expérience réelle de test (values + KPI + viz_data présents), quota chat (6ᵉ question → refus), expiration de session, sans `OPENROUTER_API_KEY` → **plateforme 100 % fonctionnelle** avec fallbacks `is_fallback: true` partout.
- [ ] **Test e2e de déterminisme XAI** : double run SHAP → valeurs strictement identiques (P4).
- [ ] Perf : SHAP Tree global (100 instances) < 30 s ; aucun blocage HTTP.

### Points de vigilance [NE PAS REPRODUIRE]
- **X1 — dashboard XAI 100 % fictif** → pas de dashboard séparé ; tout est calculé ou absent.
- **X2 — importances Gini relabellisées « SHAP »** → étiquetage strict des méthodes (P2).
- **X3 — « WebSHAP » = Math.random** → interdit par P1 ; aucun calcul XAI côté front.
- **X4 — SHAP non déterministe** → seeds partout + test de déterminisme.
- **X9 — chat bloquant 60 s dans le POST** + chemin « pré-calculé » synchrone (retro 03) → tout en file, un SEUL chemin d'exécution.
- **Aucun KPI qualité calculé en v1** (documentés mais jamais implémentés — retro 03/06) → les 6 KPI sont du code testé, pas de la doc.
- **Fidélité LIME calculée puis jetée** (retro 03) → stockée et exposée.
- **`num_samples` LIME jamais transmis, `most_used_method` en dur, `response_time` = 0.0** (retro 03) → chaque valeur affichée est réelle.
- **Instance locale fournie par le front** (retro 03) → sélection serveur paginée.
- **Router inclus 2 fois, tâches orphelines, client HTTP mort** (retro 03) → zéro code mort.
- **3 services LLM divergents** (retro 02/06) → LE client unique de J2, prompts par profil versionnés.

---

## Jalon 7 — M7 : Dashboard, suivi et annexes

**Objectif** : un accueil qui reflète la réalité de l'activité de l'utilisateur et des pages publiques/d'état propres.

### Contenu (CDC §10)
- **Dashboard `/dashboard`** : salutation, 4 tuiles KPI **réelles** (expériences totales, projets actifs, taux de succès, durée moyenne — calculées par agrégation SQL), activités récentes (expériences/explications avec statut), actions rapides (Nouveau projet / Explorer les datasets / **Reprendre le wizard en cours** si brouillon), projets récents. Remplace l'accueil provisoire de J1.
- **Liste globale des expériences `/experiments`** : table TanStack (filtres statut/projet/algo, tri, pagination), badges de statut **vivants** (les `running` se mettent à jour via SSE/polling).
- **Landing publique `/`** [SHOULD] : mission, 3 phases, CTA Connexion/Inscription — sobre, zéro lien mort.
- **Pages d'état** : 404, erreur serveur, maintenance (templates `empty-states`/`error` du kit).
- **Documentation intégrée** [SHOULD] : guide utilisateur (parcours mission illustré) + FAQ en MDX statique.

### Dépendances
J5 (expériences pour les KPI), J6 (explications dans les activités récentes).

### Definition of Done
- [ ] Démo : dashboard avec chiffres réels correspondant exactement à l'activité du compte de démo ; compte neuf → états vides engageants (jamais 0 % « décoratif », P1).
- [ ] Tests d'intégration : chaque KPI vérifié contre un état de base connu (fixtures : N expériences dont X réussies → taux exact) ; filtres/tri de la liste globale.
- [ ] E2E : badge d'une expérience `running` qui passe à `completed` sans rechargement.
- [ ] Zéro lien mort sur la landing et dans la sidebar (vérification automatisée des routes).

### Points de vigilance [NE PAS REPRODUIRE]
- **Tuiles dashboard mockées** (v1, D2 audit) → chaque chiffre est une requête réelle testée.
- **Landing v1 : vidéo YouTube + boutons non câblés** (retro 05) → sobre et fonctionnelle.
- **Vestiges du template** (retro 05 : Calendar/Chat/Email Spike non fonctionnels) → la sidebar ne référence QUE des routes vivantes ; purge complète des démos en J9.
- **/settings, /help sans routes** (retro 05) → tout lien pointe vers une page existante.

---

## Jalon 8 — M8 : Administration

**Objectif** : l'admin gère utilisateurs, catalogue, templates éthiques et supervise les jobs — sans jamais casser la sécurité.

### Contenu (CDC §11)
- **Utilisateurs** : table (recherche, tri — base `pages/users` du template), détail, changement de rôle, activation/désactivation, **recharge de crédits**, suppression. Garde : impossible de se rétrograder/désactiver si dernier admin.
- **Datasets** : vue de TOUS les datasets (y compris privés/système `created_by NULL`), édition, suppression, relance d'analyse de colonnes, statut de complétude des métadonnées.
- **Templates éthiques par domaine** : CRUD **en base** (`ethical_templates`), validation, reset défauts ; appliqués par l'import J2 quand les métadonnées enrichies manquent.
- **Supervision des jobs** [SHOULD] : table `jobs` (entraînements, explications, imports — statut, durée, file), santé du worker (heartbeat), longueur des files.
- `audit_events` [SHOULD] : traçabilité des actions admin (ARCH §6.2).

### Dépendances
J1 (RBAC), J2 (datasets/templates), J5–J6 (jobs à superviser).

### Definition of Done
- [ ] Démo : promouvoir un user en contributor, recharger des crédits, éditer un template éthique puis relancer un import qui l'applique, superviser un entraînement en cours.
- [ ] Tests d'intégration : **matrice RBAC admin complète** (user/contributor → 403 sur chaque route admin), garde dernier admin, recharge de crédits visible côté user, template appliqué à l'import, relance d'analyse.
- [ ] Le menu Administration n'apparaît que pour le rôle admin (et la sécurité reste backend).

### Points de vigilance [NE PAS REPRODUIRE]
- **Templates éthiques en YAML sur le filesystem** (retro 01) → en base, avec audit.
- **Endpoints admin sans contrôle de rôle** (S1/S2) → `require_role("admin")` sur CHAQUE route, testé.
- **`/admin/temporary-grant`** → n'existe pas ; élévation uniquement par un admin authentifié (auditée).
- **Debug endpoints non authentifiés via gateway** (retro 04) → aucun endpoint de debug en prod.

---

## Jalon 9 — Finalisation : seed, e2e mission, durcissement

**Objectif** : une instance fraîche est démontrable en 20 minutes, le parcours mission complet est vérifié automatiquement, et l'application est durcie pour un déploiement mono-machine.

### Contenu

**Seed & démo** (CDC §12.5)
- `ibis seed` : compte admin + import de **5 datasets prioritaires sans clé Kaggle** (iris, student_performance, titanic, pima_diabetes, wine_quality — fichiers embarqués/miroir), métadonnées éthiques enrichies complètes.
- Import Kaggle complet (~30 datasets, CDC §5.5.a) documenté comme commande admin.
- Script de démo 20 min (persona enseignant) documenté dans `docs/`.

**E2E parcours mission** (CDC §12.4)
- Playwright : **inscription → onboarding → création projet → scoring/recommandations → wizard 9 étapes → résultats → explication SHAP → chat** — en FR et EN. Job CI nightly sur `docker compose up`.
- Ré-exécution des tests de déterminisme (entraînement + SHAP) sur l'image finale.

**Durcissement & production** (CDC §12.3 ; ARCH §11–13)
- `compose.prod.yml` + **Caddy** (TLS auto, route `/` → web, `/api` → api, retrait des ports directs, restart policies) ; en-têtes de sécurité (CSP, X-Frame-Options).
- Revue sécurité : rate limiting, validation des uploads (extension + parsing effectif + taille), aucun secret en clair (scan automatisé type gitleaks en CI), logs prod sans PII ni DEBUG, rotation documentée des clés, bannière d'avertissement PII avant entraînement sur colonnes sensibles [SHOULD].
- **Purge du template** : suppression des routes démo inutilisées (crypto, hotel, ecommerce…) après vérification qu'aucun pattern restant n'est utile — **tokens, thème et composants `components/ui` intacts** (P6).
- Vérification des cibles de perf (CDC §12.2) mesurées et consignées.
- Beat/maintenance : purge sessions chat 24 h, nettoyage `/data/tmp`, expiration analyses qualité 7 j (ARCH §10) — vérifiés.
- Docs finales : README racine (quickstart), CHANGELOG, guide de déploiement VPS.

### Dépendances
Tous les jalons précédents.

### Definition of Done
- [ ] Machine vierge : `cp .env.example .env` (+ 2 secrets générés) → `docker compose up` → **démo complète du parcours mission en 20 min sans aucune clé externe** (LLM en fallback marqué si pas de clé).
- [ ] E2E Playwright mission complet vert en CI (nightly), FR + EN.
- [ ] Tests de déterminisme verts sur l'image finale (P4).
- [ ] Scan secrets vert ; audit npm/pip sans vulnérabilité critique ; profil prod fonctionnel derrière Caddy avec TLS.
- [ ] Aucune route morte, aucune démo template résiduelle dans la navigation ; design du kit inchangé.
- [ ] Cibles de perf §12.2 mesurées et atteintes (ou écart documenté et justifié).

### Points de vigilance [NE PAS REPRODUIRE]
- **La v1 n'a jamais eu de e2e ni de CI de test** (S9) → le parcours mission EST le test d'acceptation final.
- **AUTO_INIT_DATA au boot** (retro 01) → seed = commande explicite, idempotente.
- **Import Kaggle `return False` silencieux** (S4) → toute erreur d'import est visible et loggée.
- **Secrets v1 dans l'historique git** (S7) → vérifier qu'AUCUNE clé v1 n'a été réutilisée ; scan CI permanent.
- **Dumps de debug en prod** (retro 01/04) → logging structuré par niveaux, DEBUG jamais actif en prod.

---

## Annexe — Traçabilité CDC → jalons

| Section CDC | Contenu | Jalon(s) |
|---|---|---|
| §1.4 | Principes P1–P7 | transverse (tous) |
| §1.6 | Parcours mission / fil unique | J4 (stepper), J5–J6 (wizard→XAI) |
| §3.1–3.2 | Rôles + matrice RBAC | J1 (base + tests), J2/J8 (routes concernées) |
| §3.3 | Quotas & crédits | J1 (socle env), J5 (entraînements), J6 (chat/LLM), J8 (recharge) |
| §4 | M1 auth/onboarding/profil | J1 |
| §5.2 | Modèle de métadonnées | J2 |
| §5.3 | Listing & filtration | J2 (filtre score éthique finalisé J3) |
| §5.4 | Détail 4 onglets + guide IA | J2 |
| §5.5 | Ingestion Kaggle + upload | J2 (seed final J9) |
| §6.2–6.3 | Formules de scoring + 12 critères | J3 |
| §6.4 | UX scoring + heatmap | J3 (exploration libre), J4 (projet) |
| §7 | Projets & benchmarking | J4 (projets/recommandations), J5 (comparaison d'expériences) |
| §8.1–8.2 | 9 étapes canoniques du wizard | J5 |
| §8.3 | Contrat du worker | J5 |
| §9.2 | Méthodes XAI | J6 |
| §9.3 | KPI de qualité | J6 |
| §9.4 | Graphes XAI | J6 |
| §9.5 | Explication LLM adaptative | J6 |
| §9.6 | Chat XAI | J6 |
| §10 | Dashboard, expériences, landing, états | J7 |
| §11 | Administration | J8 (CLI create-admin dès J1) |
| §12.1 | UX/UI, i18n, dark mode, accessibilité | J0–J1 (mise en place), transverse |
| §12.2 | Performance | DoD de J2, J3, J5, J6 ; mesure finale J9 |
| §12.3 | Sécurité | J1 (auth), transverse, durcissement J9 |
| §12.4 | Qualité & tests | transverse, e2e mission J9 |
| §12.5 | Seed & démo 20 min | J9 (base posée J2) |
| ARCH §14 | ADR-001 → 007 | J0 |
