# IBIS-X v2 — Document d'architecture

> **Version** : 1.0 — 16 juillet 2026
> **Statut** : Décisions d'architecture de la refonte. Chaque section « Décision » est destinée à être formalisée en **ADR Zelian** (Phase 2).
> **Document lié** : [01-CAHIER-DES-CHARGES.md](01-CAHIER-DES-CHARGES.md) (exigences fonctionnelles M1–M8, principes P1–P7).

---

## 1. Philosophie et contraintes

La v1 (4 microservices FastAPI + Angular + Kubernetes/minikube) a prouvé le concept et tué le projet à petit feu : OOMKilled récurrents, contrats désalignés entre services, logique dupliquée 3×, couplages par SQL inter-bases et copie de code entre images. Contraintes actées pour la v2 :

1. **Application classique, pas de microservices** : un seul backend modulaire + un worker, orchestrés par **Docker Compose**. Pas de Kubernetes, pas de gateway dédiée, pas de service mesh.
2. **Un seul langage backend** partagé entre l'API et le worker (zéro duplication de logique métier, zéro contrat interne à maintenir).
3. **Frontend découplé** construit sur le template `shadcn-ui-kit-dashboard` (Next.js 16).
4. **RBAC maison simple** : JWT + rôles en base. Pas d'IDP externe (pas de Supabase/Keycloak/Auth0).
5. Dimensionné pour **une machine** (dev laptop ou VPS 4 vCPU / 8 GB RAM) et quelques dizaines d'utilisateurs simultanés — c'est un outil de recherche, pas un SaaS à scaler.
6. Tout doit servir les principes **P1–P7** du cahier des charges (honnêteté, source unique, reproductibilité, maintenable par un seul dev).

---

## 2. Décision n°1 (ADR-001) — Stack technique

### 2.1 Choix

| Couche | Technologie | Version cible |
|---|---|---|
| Frontend | **Next.js 16** (App Router) + React 19 + TypeScript 5.9 | celle du template |
| UI | Tailwind CSS 4 + **shadcn/ui** (Radix) + lucide-react + **Recharts** + TanStack Table + react-hook-form + zod + next-intl + next-themes | template |
| Backend API | **Python 3.12 + FastAPI** (≥ 0.115) + Pydantic v2 | dernière stable |
| Worker | **Celery 5.4** (même codebase Python que l'API) | dernière stable |
| ORM / migrations | SQLAlchemy 2.0 + Alembic | dernière stable |
| Base de données | **PostgreSQL 16** | image officielle |
| Broker / cache | **Redis 7** | image officielle |
| ML / XAI | scikit-learn, pandas, SHAP, LIME (détail §9) | épinglées |
| Conteneurisation | Docker + **Docker Compose** (profil dev et prod) | v2 |

### 2.2 Pourquoi PAS NestJS (la question posée)

L'option « Next.js + NestJS » a été sérieusement évaluée et **rejetée** pour le backend :

1. **Le cœur du produit est du calcul data-science Python.** Nettoyage (pandas, scipy), entraînement (scikit-learn), explicabilité (SHAP, LIME) n'ont **aucun équivalent crédible en Node.js**. Avec NestJS, il faudrait de toute façon un service Python pour tout ce qui a de la valeur — on recréerait exactement la fracture microservices qu'on veut abolir : deux langages, deux modèles de données, un contrat interne API↔worker à synchroniser en permanence (le mal n°1 de la v1 d'après l'audit).
2. **La logique métier est indissociable du calcul.** Le scoring multi-critères, les recommandations de nettoyage, la validation des hyperparamètres appartiennent au même domaine que le preprocessing : les mettre dans NestJS obligerait à dupliquer les règles (violation P3), les mettre en Python vide NestJS de sa substance.
3. **FastAPI couvre tout ce que NestJS apporterait** : typage fort (Pydantic v2), OpenAPI auto-généré (dont on dérive le client TypeScript du front — voir §5), DI, middlewares, écosystème mature.
4. **P7 (un seul dev)** : une seule stack backend = moitié moins de dépendances, de tooling, de CI.

Le « changement de technologie » demandé est bien réel : Angular → Next.js/React, microservices → monolithe modulaire, Kubernetes → Docker Compose, fastapi-users → auth maison simple, matplotlib/PNG → données JSON + Recharts, versions 2023 → stack 2026. Le langage backend reste Python **parce que le domaine l'impose**.

### 2.3 Ce que le frontend reprend du template

Le template `shadcn-ui-kit-dashboard-main` fournit : layout sidebar + topbar, pages login/register/forgot-password, profil/settings/users, onboarding-flow, empty/error states, le wrapper `chart.tsx` (Recharts), la table (TanStack), le theme customizer et le dark mode. On garde sa structure `app/dashboard/(auth)/…` / `(guest)/…`, ses composants `components/ui/*`, et on supprime les démos métier inutiles (crypto, hotel, pos-system…) après extraction des patterns utiles (project-list, file-manager pour l'upload, api-keys pour l'admin).

---

## 3. Vue d'ensemble

```
                        ┌────────────────────────────────────────────────┐
                        │                DOCKER COMPOSE                  │
                        │                                                │
  Navigateur ──HTTPS──▶ │  ┌─────────┐      ┌──────────────────────────┐ │
                        │  │  web    │      │           api            │ │
                        │  │ Next.js │─────▶│  FastAPI (uvicorn)       │ │
                        │  │  :3000  │ REST │  auth · datasets · score │ │
                        │  └─────────┘ +SSE │  projects · experiments  │ │
                        │                   │  explanations · admin    │ │
                        │                   └───────┬────────┬─────────┘ │
                        │                           │        │           │
                        │              SQLAlchemy   │        │ enqueue   │
                        │                   ┌───────▼──┐  ┌──▼────────┐  │
                        │                   │ postgres │  │   redis   │  │
                        │                   │   :5432  │  │   :6379   │  │
                        │                   └───────▲──┘  └──▲────────┘  │
                        │                           │        │ consume   │
                        │                   ┌───────┴────────┴─────────┐ │
                        │                   │         worker           │ │
                        │                   │  Celery (même image      │ │
                        │                   │  que l'api) : training,  │ │
                        │                   │  xai, llm, imports       │ │
                        │                   └───────────┬──────────────┘ │
                        │                               │                │
                        │                        ┌──────▼──────┐         │
                        │                        │   volume    │         │
                        │                        │  ibis-data  │ (Parquet│
                        │                        │  (partagé   │  modèles│
                        │                        │  api+worker)│  .joblib)│
                        │                        └─────────────┘         │
                        └────────────────────────────────────────────────┘
```

**5 conteneurs** (contre 11 workloads K8s en v1) : `web`, `api`, `worker`, `postgres`, `redis` — plus un reverse proxy (`caddy`) en profil production pour TLS. `api` et `worker` sont **la même image Docker** avec deux commandes différentes : c'est ce qui garantit zéro divergence de code entre l'API et l'exécution des jobs ([NE PAS REPRODUIRE] la v1 copiait `app/ml/` d'un service dans l'image d'un autre).

---

## 4. Organisation du code (monorepo)

```
ibis-x/
├─ docker-compose.yml            # dev (hot reload) — profil prod : compose.prod.yml + Caddy
├─ .env.example                  # TOUTES les variables documentées, aucun secret réel
├─ apps/
│  ├─ web/                       # Next.js 16 (issu du template shadcn-ui-kit-dashboard)
│  │  ├─ app/
│  │  │  ├─ (guest)/             # landing, login, register, forgot-password
│  │  │  ├─ (app)/               # layout sidebar : dashboard, datasets, projects,
│  │  │  │                       #   experiments, explanations, profile, admin
│  │  │  └─ wizard/              # wizard ML plein écran (9 étapes)
│  │  ├─ components/ui/          # shadcn (inchangé)
│  │  ├─ components/ibis/        # composants métier (dataset-card, score-heatmap,
│  │  │                          #   mission-stepper, kpi-tile, cleaning-table, …)
│  │  ├─ lib/api/                # client TypeScript GÉNÉRÉ depuis l'OpenAPI (§5.2)
│  │  ├─ lib/i18n/  messages/fr.json  messages/en.json
│  │  └─ stores/                 # Zustand : wizard-store (source unique, P3)
│  └─ api/                       # Python 3.12 — UNE app, DES modules
│     ├─ pyproject.toml          # uv/poetry, deps épinglées
│     ├─ alembic/                # migrations (chaîne unique)
│     ├─ ibis/
│     │  ├─ main.py              # création FastAPI, routers, middlewares
│     │  ├─ core/                # config (pydantic-settings), sécurité JWT, deps RBAC,
│     │  │                       #   erreurs typées, logging structuré
│     │  ├─ db/                  # engine, session, base — modèles par module
│     │  ├─ modules/
│     │  │  ├─ auth/             # routes, service, modèles User/RefreshToken
│     │  │  ├─ users/            # profil, crédits, admin users
│     │  │  ├─ datasets/         # routes, service, modèles, filtres, préview, upload
│     │  │  ├─ scoring/          # LES formules (12 critères) — module pur, testé unitairement
│     │  │  ├─ projects/         # CRUD + recommandations (compose datasets+scoring)
│     │  │  ├─ experiments/      # routes, service, modèles, contrat preprocessing v2
│     │  │  ├─ ml/               # preprocessing, algorithms (registre), evaluation, viz-data
│     │  │  ├─ xai/              # explainers SHAP/LIME, KPI qualité, viz-data
│     │  │  ├─ llm/              # client unique OpenRouter/OpenAI, prompts, fallbacks P2
│     │  │  └─ admin/            # templates éthiques, supervision jobs
│     │  ├─ workers/             # celery_app + tâches : train, explain, chat, import, guide
│     │  ├─ storage/             # abstraction fichiers : LocalFSStorage (défaut) / S3Storage
│     │  └─ cli.py               # `ibis create-admin`, `ibis import-kaggle`, `ibis seed`
│     └─ tests/                  # unit / integration / e2e-determinism
└─ docs/                         # Zelian : adr/, specs/, architecture/
```

Règles d'organisation :
- **`modules/*` ne s'importent qu'en descendant** (routes → service → modèles) ; les partages transverses passent par `core/`, `storage/`, `modules/scoring` (pur) — pas d'import circulaire.
- Le **worker importe les mêmes services** que l'API (`modules/ml`, `modules/xai`) : une seule implémentation du preprocessing, du scoring, des métriques (P3).
- Fichier > ~500 lignes côté Python ou > 400 côté TSX = signal de découpage (P7). [NE PAS REPRODUIRE] main.py de 4 105 lignes.

---

## 5. Communication dans l'application

### 5.1 Navigateur ↔ web ↔ api

- Le front appelle l'API en REST JSON sous `/api/v1/*`. En dev : proxy Next (`rewrites`) vers `http://api:8000` ; en prod : Caddy route `/api/*` → api, le reste → web. **Même origine** → pas de CORS à gérer, cookies simples.
- **Authentification des appels** : header `Authorization: Bearer <access_token>` géré par le client API généré ; refresh token en **cookie httpOnly** `Secure SameSite=Lax` (voir §7).

### 5.2 Contrat unique : OpenAPI → client TypeScript généré [ADR-007-bis]

Le mal n°1 de la v1 était la dérive des contrats front/back. Solution structurelle :
- FastAPI génère l'**OpenAPI** exhaustif (schemas Pydantic v2 stricts, `extra="forbid"` sur les payloads d'écriture).
- Une étape de build (`openapi-typescript` + fetch wrapper, ou `orval`) génère `apps/web/lib/api/` : **types + fonctions d'appel typées**. Le front n'écrit JAMAIS un appel fetch à la main ni ne redéclare un type d'API.
- La CI échoue si le client généré n'est pas à jour avec le schéma (diff check).

### 5.3 Temps réel (progression des jobs) [ADR-007]

- **SSE (Server-Sent Events)** : `GET /api/v1/jobs/{job_id}/events` — l'API s'abonne aux mises à jour (Redis pub/sub alimenté par le worker) et pousse `{status, progress, log_line}` au navigateur. Unidirectionnel, passe partout (HTTP simple), suffisant pour progression + logs.
- **Repli polling** : tous les endpoints de statut restent interrogeables (2 s) si SSE indisponible.
- WebSocket : non retenu (aucun besoin bidirectionnel — le chat XAI est requête→job→réponse).

### 5.4 api ↔ worker

- **File de jobs Celery sur Redis** (broker + result backend). Queues : `training` (entraînements, concurrence 1–2), `xai` (explications), `llm` (textes/chat/guides, concurrence 4), `maintenance` (imports, nettoyages).
- L'API n'exécute **jamais** de calcul lourd dans une requête HTTP ([NE PAS REPRODUIRE] le chemin XAI « pré-calculé » synchrone v1).
- Le worker écrit sa progression en base (source de vérité) **et** publie sur Redis pub/sub (temps réel). Timeouts durs (training 2 h, xai 30 min, llm 2 min), `acks_late`, retries techniques ×3 avec backoff, révocation propre pour l'annulation, détection de worker perdu (job `running` sans heartbeat > 10 min → `failed: WORKER_LOST`).
- Il n'y a **plus d'appels HTTP internes entre « services »** : API et worker partagent le code et la base. La communication est : Postgres (état durable) + Redis (file + pub/sub). Fin des URLs internes, du SQL cross-service et des headers de confiance ([NE PAS REPRODUIRE] X-User-ID forgeable, SELECT direct dans la base d'un autre service).

---

## 6. Décision n°2 (ADR-002) — Base de données

### 6.1 Choix : PostgreSQL 16, une base, un schéma, une chaîne Alembic

PostgreSQL est **nécessaire** (pas seulement confortable) : colonnes `ARRAY` (domaines/tâches des datasets) avec index **GIN** pour les filtres de containment, `JSONB` (métriques, configs, stats de colonnes, critères de projets), contraintes et transactions pour l'intégrité multi-tables, `pg_trgm` pour la recherche plein texte simple. SQLite ne tiendrait pas (ARRAY/JSONB/concurrence worker), MySQL n'apporte rien ici.

Une **seule chaîne de migrations Alembic** ([NE PAS REPRODUIRE] 4 chaînes parallèles v1). Migrations exécutées au démarrage de l'api (entrypoint `alembic upgrade head`, verrou advisory pour éviter les courses).

### 6.2 Schéma (tables et colonnes clés)

**Auth & comptes**
- `users` : id UUID PK, email UNIQUE, hashed_password **NULL** (Argon2id — NULL pour les comptes « Google uniquement »), role ENUM(`user`,`contributor`,`admin`), is_active, pseudo, avatar_path, given_name, family_name, locale, education_level, age, ai_familiarity SMALLINT, xai_audience ENUM(`novice`,`intermediate`,`expert`) (dérivé, modifiable), credits INT DEFAULT 100, onboarding_completed_at, created_at/updated_at.
- `refresh_tokens` : id, user_id FK, token_hash, expires_at, revoked_at, user_agent, created_at (rotation : un nouveau à chaque refresh, l'ancien révoqué).
- `password_reset_tokens` : user_id, token_hash, expires_at, used_at.
- `oauth_identities` : id, user_id FK CASCADE, provider (`google`), subject (le `sub` de l'id_token), email, created_at — contrainte UNIQUE(provider, subject). Aucun access/refresh token Google stocké.

**Catalogue**
- `datasets` : toutes les colonnes de métadonnées du CDC §5.2 (dont `domain TEXT[]`, `task TEXT[]` + index GIN, les 10 critères éthiques `BOOLEAN NULL` tristate), `created_by UUID NULL`, timestamps.
- `dataset_files` : id, dataset_id FK CASCADE, original_filename, storage_key (UUID.parquet), logical_role, format, size_bytes, row_count.
- `dataset_columns` : id, file_id FK CASCADE, name, dtype_original, dtype_interpreted, is_nullable, is_pii, example_values TEXT[], position, stats JSONB.
- `ethical_templates` : domain UNIQUE, defaults JSONB (10 critères + niveaux), updated_by, updated_at.
- `quality_analyses` : dataset_id, analysis JSONB (l'analyse M5-É3 complète), quality_score, column_recommendations JSONB, computed_at, expires_at (cache 7 j).

**Projets & expériences**
- `projects` : id, user_id FK (index), name, description, criteria JSONB, weights JSONB, timestamps.
- `experiments` : id UUID, user_id, project_id FK, dataset_id FK, algorithm VARCHAR, hyperparameters JSONB, preprocessing_config JSONB (contrat v2 strict), status ENUM(`draft`,`pending`,`running`,`completed`,`failed`,`cancelled`), progress SMALLINT, job_id, error_code, error_message, metrics JSONB, viz_data JSONB (**données** de graphes, pas d'images), feature_importance JSONB, artifact_key (chemin .joblib), started_at, finished_at, duration_seconds, timestamps. Le statut `draft` porte la reprise du wizard.
- `experiment_logs` [SHOULD] : experiment_id, ts, level, message (console de progression rejouable).

**XAI**
- `explanations` : id, user_id, experiment_id FK, type ENUM(`global`,`local`), method_requested, method_used, audience_level, language, instance_ref JSONB (index de l'instance de test + valeurs), status/progress/job_id/error_code, values JSONB (SHAP ou LIME), quality_kpis JSONB (fidélité, complétude, stabilité, accord, parcimonie), viz_data JSONB, text_explanation TEXT, model_used, is_fallback BOOL, processing_seconds, timestamps.
- `chat_sessions` : id, explanation_id FK CASCADE, language, questions_count, max_questions (5), status, last_activity.
- `chat_messages` : id, session_id FK CASCADE, role ENUM(`user`,`assistant`,`system`), content, model_used, tokens_used, response_seconds, created_at.

**Transverse**
- `jobs` (vue de supervision) : id, kind ENUM(`training`,`explanation`,`chat`,`import`,`guide`), user_id, ref_id, status, progress, queue, created/started/finished_at — alimentée par le worker (l'admin M8 lit cette table).
- `audit_events` [SHOULD] : user_id, action, entity, entity_id, ts (traçabilité des actions admin).

Toutes les valeurs `JSONB` sont **assainies** (jamais de NaN/Inf — sanitizer unique).

---

## 7. Décision n°3 (ADR-003) — Authentification & RBAC

### 7.1 Mécanique

- **Sans IDP tiers** (pas d'Auth0/Clerk/Firebase/Supabase — rien d'hébergé, rien de facturable). Implémentation directe et courte (~300 lignes) : `pyjwt` + `argon2-cffi`, pas de framework d'auth lourd ([NE PAS REPRODUIRE] fastapi-users : trop de magie pour 5 endpoints, migrations subies en v1). La connexion Google (ci-dessous) est une simple fédération OIDC gratuite, pas un IDP : c'est toujours notre backend qui émet et gère les sessions.
- **Access token JWT** : HS256, secret ≥ 256 bits (env), durée **30 min**, claims : `sub` (user id), `role`, `exp`, `iat`, `jti`. Transporté en header Bearer, stocké en mémoire côté front (jamais en localStorage).
- **Refresh token** : opaque (256 bits aléatoires), haché en base, durée **7 jours**, **rotation à chaque usage** (l'ancien est révoqué ; réutilisation d'un token révoqué → révocation de toute la famille = détection de vol). Posé en cookie `httpOnly Secure SameSite=Lax` sur `/api/v1/auth`.
- Endpoints : `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/reset-password`.
- **Connexion Google (OIDC direct, gratuit)** : pas d'IDP tiers — on parle directement au protocole OAuth 2.0/OIDC de Google avec **authlib** (identifiants OAuth créés dans Google Cloud Console, gratuits sans limite pertinente pour ce projet). Flux : `GET /auth/google/authorize` (génère l'URL Google avec `state` + PKCE) → callback front `/auth/google/callback` → `POST /auth/google/exchange` (le backend échange le code, **valide la signature de l'`id_token` et `email_verified`**, upsert l'identité) → émission de **nos** access/refresh tokens, identiques au flux mot de passe. Liaison de compte : si l'email vérifié Google correspond à un compte existant, l'identité est rattachée (pas de doublon) ; sinon création (`hashed_password NULL`, onboarding requis). Aucun token Google n'est conservé au-delà de l'échange (on ne consomme aucune API Google ensuite).
- Rate limiting sur `/auth/*` (slowapi/redis : 10/min/IP).

### 7.2 RBAC

- Rôle unique par utilisateur (`user` < `contributor` < `admin`), stocké en base, **embarqué dans le JWT** (pas de round-trip DB pour lire le rôle ; l'access token court limite la fenêtre de désynchronisation ; les actions admin critiques revérifient en base).
- Enforcement par **dépendances FastAPI** : `CurrentUser`, `require_role("contributor")`, `require_owner_or_admin(resource)` — appliquées route par route, testées par la matrice du CDC §3.2.
- Côté front : le layout masque ce qui n'est pas permis (menu admin…), mais **la sécurité est backend** — le front n'est qu'ergonomique.
- Premier admin : `ibis create-admin <email>` (CLI) ou `INITIAL_ADMIN_EMAIL`/`INITIAL_ADMIN_PASSWORD` au premier boot.

---

## 8. Décision n°4 (ADR-005) — Stockage des fichiers

- **Backend de stockage abstrait** (`storage/`) avec **deux drivers** : `LocalFSStorage` (défaut — volume Docker `ibis-data` monté dans `api` ET `worker`) et `S3Storage` (optionnel : MinIO/S3/Azure via boto3-compatible, activable par `STORAGE_BACKEND=s3`). La v2 démarre **sans MinIO** : un conteneur de moins, zéro configuration.
- Arborescence du volume :
  ```
  /data/datasets/{dataset_id}/{file_uuid}.parquet
  /data/models/{experiment_id}/model.joblib
  /data/avatars/{user_id}.webp
  /data/tmp/…            (uploads en cours, nettoyés par tâche maintenance)
  ```
- **Format canonique des données : Parquet** (compression Snappy) — conversion à l'ingestion (CSV/XLSX/JSON → Parquet), lecture pandas/pyarrow.
- Les fichiers ne sont **servis que par l'API** (endpoints authentifiés, streaming) ; aucun accès direct au volume depuis l'extérieur.
- Les **visualisations ne sont plus des fichiers** : ce sont des données JSON en base (`viz_data`) rendues par Recharts ([NE PAS REPRODUIRE] PNG base64 en BDD).

---

## 9. Décision n°5 (ADR-006) — IA : bibliothèques ML, XAI et LLM

### 9.1 Pile data-science (versions épinglées dans pyproject, indicatives)

| Rôle | Lib | Version indicative | Notes |
|---|---|---|---|
| Dataframes | pandas | ≥ 2.2 | + pyarrow ≥ 16 (Parquet) |
| Calcul | numpy | 1.26.x | épinglée < 2 tant que shap/lime ne sont pas validées numpy 2 |
| ML | scikit-learn | ≥ 1.5 | DecisionTree, RandomForest, ColumnTransformer, imputers (Simple/KNN/Iterative), StandardScaler/MinMax/Robust, OneHot/Ordinal, métriques |
| Stats | scipy | ≥ 1.13 | normaltest, skewness (analyse de distribution) |
| Sérialisation | joblib | ≥ 1.4 | artefacts `{model, preprocessing_pipeline, feature_names, training_config}` |
| XAI | **shap** | ≥ 0.46 | TreeExplainer (défaut arbres), KernelExplainer (repli) |
| XAI | **lime** | 0.2.0.1 | LimeTabularExplainer |
| Corrélations de rangs | scipy.stats.spearmanr | — | KPI stabilité & accord inter-méthodes |

**Registre d'algorithmes** : chaque algo = un wrapper (`fit/predict/predict_proba/importances/tree_structure`) + un **schéma d'hyperparamètres** (source du formulaire dynamique de l'étape 7 et de la validation Pydantic). Ajout d'un algo = 1 fichier + 1 entrée de registre. La validation API n'accepte que les clés du registre ([NE PAS REPRODUIRE] T8).

**Garanties de reproductibilité (P4)** : `random_state=42` partout (split, modèle, `shap.sample`, LIME, échantillonnage d'aperçu) ; les seeds et politiques (ex. `multiclass_policy: mean_abs`) sont **enregistrés** dans `explanations.values.metadata` ; test e2e « double run → diff nulle ».

### 9.2 KPI XAI — implémentation

- **Complétude SHAP** : `abs(sum(shap_values) + base_value − prediction) / max(|prediction|, ε) < 0.01`.
- **Stabilité** : 5 recalculs sur 5 sous-échantillons (seeds 42…46) → Spearman moyen des classements top-10.
- **Fidélité LIME** : `explanation.score` (R² local) remonté et stocké.
- **Accord SHAP↔LIME** : Spearman des rangs top-10 quand les deux ont été calculées.
- **Parcimonie** : plus petit k tel que la somme des importances triées ≥ 80 % du total.
Chaque KPI = fonction pure testée unitairement dans `modules/xai/quality.py`.

### 9.3 LLM (assistant, explications textuelles, chat)

- **Client unique** dans `modules/llm` ([NE PAS REPRODUIRE] 3 versions du service LLM en v1) : **OpenRouter, exclusivement** — c'est par lui qu'on accède aux modèles OpenAI (base URL `https://openrouter.ai/api/v1`, SDK openai pointé dessus). **Une seule clé** (`OPENROUTER_API_KEY`), un seul chemin de code, pas de second fournisseur à maintenir. Modèle piloté par `LLM_MODEL` (défaut : un modèle OpenAI mini économique, ex. `openai/gpt-5-mini`) — changer de modèle ou de fournisseur amont = changer une variable d'env, zéro code.
- **Température 0** pour toute explication (P4) ; gestion des modèles reasoning (max_completion_tokens) encapsulée dans le client.
- **Anti-hallucination** : le prompt fournit exclusivement les données réelles (métriques, valeurs SHAP, schéma du dataset) ; post-validation : tout nombre cité dans la sortie doit exister dans le contexte, sinon on régénère ou on tombe en fallback template.
- **Fallback déterministe** : chaque usage LLM a un template construit sur les vraies données, marqué `is_fallback: true` (P2). La plateforme reste 100 % fonctionnelle **sans aucune clé LLM** (features IA dégradées mais honnêtes).
- Budget : plafonds `LLM_MAX_TOKENS`, quota crédits utilisateur, timeout 60 s, file `llm` dédiée.

---

## 10. Décision n°6 (ADR-004) — Worker & jobs (récapitulatif)

- **Celery 5.4 + Redis**, un conteneur `worker` (même image que l'api) : `celery -A ibis.workers worker -Q training,xai,llm,maintenance --concurrency=2 --max-tasks-per-child=10 --max-memory-per-child=2000000`.
- Beat (planification) : tâches périodiques `maintenance` — purge des sessions chat expirées (24 h), nettoyage `/data/tmp`, expiration des analyses qualité (7 j).
- Chaque tâche : idempotente au retry, écrit `progress` + publie pub/sub, statuts et `error_code` typés, nettoyage des artefacts partiels en échec.
- Scalable verticalement si besoin (2ᵉ conteneur worker avec `-Q training` seul) sans rien changer au code.

---

## 11. Docker Compose (topologie)

```yaml
# docker-compose.yml — dev (indicatif)
services:
  web:
    build: apps/web            # dev : next dev ; prod : next build + start (standalone)
    ports: ["3000:3000"]
    environment: [ NEXT_PUBLIC_API_URL=/api ]
    depends_on: [ api ]
  api:
    build: apps/api
    command: sh -c "alembic upgrade head && uvicorn ibis.main:app --host 0.0.0.0 --port 8000"
    env_file: .env
    volumes: [ "ibis-data:/data" ]
    depends_on: { postgres: {condition: service_healthy}, redis: {condition: service_started} }
  worker:
    build: apps/api            # MÊME image que api
    command: celery -A ibis.workers worker -Q training,xai,llm,maintenance -c 2 -B
    env_file: .env
    volumes: [ "ibis-data:/data" ]
    depends_on: [ api, redis, postgres ]
    mem_limit: 4g
  postgres:
    image: postgres:16-alpine
    environment: [ POSTGRES_DB=ibis, POSTGRES_USER=ibis, POSTGRES_PASSWORD=${POSTGRES_PASSWORD} ]
    volumes: [ "pg-data:/var/lib/postgresql/data" ]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U ibis"], interval: 5s }
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes: [ "redis-data:/data" ]
volumes: { ibis-data: {}, pg-data: {}, redis-data: {} }
# compose.prod.yml ajoute : caddy (TLS auto, route / → web, /api → api), restart policies,
# et retire les ports directs de web/api.
```

Variables d'environnement (`.env.example` exhaustif) : `POSTGRES_PASSWORD`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `ACCESS_TOKEN_MINUTES=30`, `REFRESH_TOKEN_DAYS=7`, `STORAGE_BACKEND=local`, `DATA_DIR=/data`, `OPENROUTER_API_KEY`, `LLM_MODEL=openai/gpt-5-mini`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OAUTH_REDIRECT_URL`, `KAGGLE_USERNAME`, `KAGGLE_KEY`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, `SMTP_*` (optionnel), quotas (`MAX_CONCURRENT_TRAININGS=3`, `MAX_DAILY_TRAININGS=20`, `DEFAULT_CREDITS=100`, `MAX_CHAT_QUESTIONS=5`).

**Budget mémoire cible** (machine 8 GB) : postgres ~0.5 G, redis ~0.2 G, api ~0.5 G, worker ≤ 4 G (pics entraînement/SHAP), web ~0.5 G — marge confortable là où minikube étouffait.

---

## 12. Observabilité, qualité, CI/CD

- **Logs structurés JSON** (structlog) avec `request_id` / `job_id` corrélés API↔worker ; niveau DEBUG jamais actif en prod ([NE PAS REPRODUIRE] dumps de debug en prod v1).
- `GET /api/v1/health` (liveness : DB + Redis + volume) ; `GET /api/v1/health/worker` (heartbeat Celery). Table `jobs` pour la supervision admin.
- Sentry optionnel (`SENTRY_DSN`).
- **CI GitHub Actions** (sur PR) : ruff + mypy + pytest (unit/integration, Postgres service) côté api ; eslint + tsc + vitest + build côté web ; vérification client OpenAPI à jour ; build des images. E2E Playwright sur `docker compose up` en job nightly.
- Conventions : Conventional Commits, versionnage semver du projet, CHANGELOG tenu (workflow Zelian).

---

## 13. Sécurité (synthèse)

1. Secrets uniquement via env ; `.env` gitignoré ; **rotation obligatoire** de toutes les clés exposées par la v1 (OpenAI/OpenRouter, Google, JWT, Kaggle — considérées compromises).
2. Argon2id, JWT 30 min, refresh rotation + détection de réutilisation, rate limiting auth.
3. RBAC backend systématique (rôle + ownership) — testé par la matrice CDC §3.2.
4. Uploads : validation extension + parsing effectif (un fichier qui ne se parse pas est rejeté), taille max 100 MB, noms de stockage UUID, jamais d'exécution de contenu.
5. Le worker et la base ne sont pas exposés ; seuls `web` (et `api` via proxy) sont publiés. En prod, Caddy termine TLS.
6. En-têtes de sécurité (CSP raisonnable, X-Frame-Options) posés par le proxy ; CORS inutile (même origine).
7. Pas de PII dans les logs ; `is_pii` signalé sur les colonnes pour avertir l'utilisateur avant entraînement sur des colonnes sensibles [SHOULD : bannière d'avertissement].

---

## 14. Récapitulatif des ADR à formaliser (Zelian Phase 2)

| ADR | Décision | Résumé |
|---|---|---|
| ADR-001 | Stack | Next.js 16 + shadcn (template) / FastAPI Python 3.12 monolithe modulaire / rejet NestJS (domaine ML = Python, P3, P7) |
| ADR-002 | Base de données | PostgreSQL 16 unique, ARRAY+GIN, JSONB, une chaîne Alembic |
| ADR-003 | Auth & RBAC | JWT maison (pyjwt + argon2), access 30 min + refresh rotation cookie httpOnly, rôles user/contributor/admin en claims, dépendances FastAPI ; **connexion Google en OIDC direct (authlib, gratuit, sans IDP tiers)** émettant nos propres JWT |
| ADR-004 | Jobs asynchrones | Celery 5.4 + Redis, 4 queues, même image que l'API, progression DB + pub/sub |
| ADR-005 | Stockage fichiers | Abstraction Local FS (volume partagé, défaut) / S3 optionnel ; Parquet canonique ; plus d'images de graphes |
| ADR-006 | IA & XAI | scikit-learn/pandas épinglés ; SHAP Tree + LIME ; KPI qualité calculés ; registre d'algos ; **LLM exclusivement via OpenRouter** (une clé, un client, modèles OpenAI accessibles par `LLM_MODEL`) avec fallback déterministe honnête |
| ADR-007 | Temps réel & contrat | SSE + repli polling ; OpenAPI → client TS généré, interdiction des appels manuels |

---

## 15. Ce que cette architecture élimine (traçabilité v1 → v2)

| Problème v1 | Réponse v2 |
|---|---|
| 4 microservices + gateway, contrats désalignés | 1 backend modulaire, client TS généré depuis OpenAPI |
| Kubernetes/minikube, OOMKilled, 11 workloads | Docker Compose, 5 conteneurs, budget mémoire maîtrisé |
| 3 scorings divergents, 4 vocabulaires de nettoyage | modules `scoring` et `ml` uniques partagés api/worker (P3) |
| SQL cross-service, copie de code entre images | même codebase, même image |
| Headers X-User-ID forgeables | JWT vérifié par l'app elle-même, plus d'intermédiaire de confiance |
| PNG matplotlib base64 en BDD | données JSON + Recharts côté client |
| Mocks présentés comme données réelles | P1/P2 appliqués architecturalement (états vides, is_fallback, KPI calculés ou absents) |
| SHAP non déterministe, Math.random | random_state=42 systémique + test e2e de déterminisme |
| Chat bloquant 60 s | tout job en file + SSE |
| Secrets committés | env only + rotation des clés compromises |
| 0 % de tests | pyramide de tests + CI bloquante |
