# Discovery — IBIS-X v2

> Fichier généré automatiquement par retro-scanner. Usage interne uniquement.
> Ce fichier sera supprimé à la fin de la Phase 1-bis.

## Stack identifiée

| Composant | Valeur |
|-----------|--------|
| Framework API | FastAPI 0.115+ (ASGI/Uvicorn, Python 3.12) |
| Framework Web | Next.js 16.2.10 (App Router, TypeScript 5.9, React 19) |
| SGBD | PostgreSQL 16-alpine |
| ORM | SQLAlchemy 2.0 (DeclarativeBase, Mapped, expressions typées) |
| Migrations | Alembic (auto-apply au démarrage du conteneur api) |
| Cache / Broker | Redis 7-alpine |
| Queue asynchrone | Celery 5 (4 queues : training, xai, llm, maintenance) |
| Auth | JWT HS256 maison + Google OIDC (authlib) ; hash Argon2id |
| UI kit | shadcn/ui (Radix UI + Tailwind CSS 4) |
| State front | Zustand 5 (stores auth + stores feature-level) |
| i18n | next-intl 4 (FR + EN) |
| Charts | Recharts 2.15 |
| ML | scikit-learn 1.5, pandas 2.x, numpy 1.x, scipy |
| XAI | SHAP 0.49, LIME 0.2 |
| LLM | OpenRouter (client unique `ibis/modules/llm`, modèle piloté par env) |
| Contrat API front/back | OpenAPI → client TypeScript généré (`@hey-api/openapi-ts`) |
| Tests API | pytest 8 (26 fichiers : unit + integration) |
| Tests web | Vitest 4 (17 fichiers unitaires) + Playwright 1.61 (3 specs e2e) |
| Package manager | pnpm 10 (web), uv (api) |
| Docker | docker-compose.yml dev (5 services) + compose.prod.yml (Caddy TLS) |

---

## Features identifiées

### 1. api/auth
**Description :** Authentification complète avec JWT HS256 maison, refresh token opaque (rotation à chaque usage, révocation de famille), connexion Google OIDC via authlib, RBAC 3 niveaux (user < contributor < admin), rate-limiting Redis sur `/auth/*`, hachage Argon2id.
**Fichiers principaux :**
- `apps/api/ibis/modules/auth/routes.py`
- `apps/api/ibis/modules/auth/service.py`
- `apps/api/ibis/modules/auth/google.py`
- `apps/api/ibis/modules/auth/models.py`
- `apps/api/ibis/modules/auth/deps.py`

### 2. api/users
**Description :** Gestion du profil utilisateur — mise à jour du profil, onboarding, changement de mot de passe, upload d'avatar, suppression de compte (avec nettoyage cookie refresh).
**Fichiers principaux :**
- `apps/api/ibis/modules/users/routes.py`
- `apps/api/ibis/modules/users/service.py`
- `apps/api/ibis/modules/auth/schemas.py` (schémas partagés)

### 3. api/datasets
**Description :** Catalogue de datasets avec upload multi-fichiers (CSV/XLSX/JSON/Parquet), profiling pandas automatique (types, stats, détection PII), scoring éthique sur 10 critères (taxonomie Khelifi 2024), filtres facettés, datasets similaires, guide IA généré par LLM avec fallback déterministe.
**Fichiers principaux :**
- `apps/api/ibis/modules/datasets/routes.py`
- `apps/api/ibis/modules/datasets/service.py`
- `apps/api/ibis/modules/datasets/profiling.py`
- `apps/api/ibis/modules/datasets/ethics.py`
- `apps/api/ibis/modules/datasets/importer.py`

### 4. api/scoring
**Description :** Moteur de scoring de pertinence pondéré calculant un score composite sur 12 critères par dataset, avec décomposition par critère et profils de pondération prédéfinis (Équilibré, Haute précision, Rapide). Calcul exclusivement côté backend.
**Fichiers principaux :**
- `apps/api/ibis/modules/scoring/routes.py`
- `apps/api/ibis/modules/scoring/service.py`
- `apps/api/ibis/modules/scoring/formulas.py`
- `apps/api/ibis/modules/scoring/schemas.py`

### 5. api/experiments
**Description :** Pipeline d'expériences ML exposant le wizard 9 étapes : brouillon persisté à chaque étape, analyse qualité cachée 7 j, liste d'algorithmes avec schémas d'hyperparamètres, lancement d'entraînement, consultation des résultats et comparaison d'expériences.
**Fichiers principaux :**
- `apps/api/ibis/modules/experiments/routes.py`
- `apps/api/ibis/modules/experiments/service.py`
- `apps/api/ibis/modules/experiments/models.py`
- `apps/api/ibis/modules/experiments/schemas.py`

### 6. api/ml
**Description :** Moteur ML interne : registre d'algorithmes (DecisionTree + RandomForest v1, architecture extensible), preprocessing (encodage, imputation, normalisation), évaluation (métriques classification/régression, matrice de confusion, courbes ROC/PR), analyse qualité du dataset.
**Fichiers principaux :**
- `apps/api/ibis/modules/ml/algorithms.py`
- `apps/api/ibis/modules/ml/preprocessing.py`
- `apps/api/ibis/modules/ml/evaluation.py`
- `apps/api/ibis/modules/ml/quality.py`
- `apps/api/ibis/workers/tasks/train.py`

### 7. api/xai
**Description :** Explainabilité post-hoc avec SHAP (TreeExplainer / KernelExplainer en repli) et LIME, calcul de blocs structurés (importance, contributions locales), analyse d'équité par attribut sensible (disparité démographique, égalité des chances, règle des 80 %), sessions de chat XAI asynchrones, KPI qualité XAI (complétude, stabilité, fidélité).
**Fichiers principaux :**
- `apps/api/ibis/modules/xai/routes.py`
- `apps/api/ibis/modules/xai/engine.py`
- `apps/api/ibis/modules/xai/fairness.py`
- `apps/api/ibis/modules/xai/blocks.py`
- `apps/api/ibis/modules/xai/quality.py`
- `apps/api/ibis/workers/tasks/explain.py`

### 8. api/llm
**Description :** Client LLM unique vers OpenRouter (température 0, modèle configurable via env), prompt anti-hallucination (contexte = uniquement vraies valeurs), génération adaptative du texte d'explication XAI par niveau d'audience (novice/intermediate/expert), guide de dataset, questions suggérées pour le chat. Fallback déterministe sur toutes les features.
**Fichiers principaux :**
- `apps/api/ibis/modules/llm/client.py`
- `apps/api/ibis/modules/llm/xai_text.py`
- `apps/api/ibis/modules/llm/guides.py`

### 9. api/projects
**Description :** Gestion des projets ML — conteneurs regroupant les expériences d'un utilisateur, avec création, liste et détail.
**Fichiers principaux :**
- `apps/api/ibis/modules/projects/routes.py`
- `apps/api/ibis/modules/projects/service.py`
- `apps/api/ibis/modules/projects/models.py`

### 10. api/dashboard
**Description :** Tableau de bord KPI personnel — chiffres issus d'agrégations SQL réelles (total expériences, projets actifs, taux de succès, durée moyenne), fil d'activité récente (expériences + explications), aucune valeur décorative.
**Fichiers principaux :**
- `apps/api/ibis/modules/dashboard/routes.py`

### 11. api/admin
**Description :** Interface d'administration complète avec re-vérification du rôle admin en base sur chaque route, traçabilité via `audit_events`, gestion des utilisateurs (rôle, activation, crédits), gestion des datasets (validation, templates éthiques), supervision des jobs background.
**Fichiers principaux :**
- `apps/api/ibis/modules/admin/routes.py`
- `apps/api/ibis/modules/admin/models.py`

### 12. api/jobs
**Description :** Suivi de tâches asynchrones avec progression (0→100) publiée sur Redis, endpoint SSE (`GET /jobs/{id}/events`) alimenté par abonnement Redis pub/sub, repli polling 2 s. Partagé par le pipeline d'entraînement et les tâches XAI.
**Fichiers principaux :**
- `apps/api/ibis/modules/jobs/routes.py`
- `apps/api/ibis/modules/jobs/service.py`
- `apps/api/ibis/modules/jobs/models.py`

### 13. web/auth
**Description :** Pages login, inscription, mot de passe oublié/reset, connexion Google OAuth — routes publiques sous `(guest)/`. Access token stocké en mémoire (Zustand), jamais en localStorage.
**Fichiers principaux :**
- `apps/web/app/(guest)/login/`
- `apps/web/app/(guest)/register/`
- `apps/web/lib/auth/store.ts`
- `apps/web/components/ibis/google-button.tsx`

### 14. web/onboarding
**Description :** Parcours de première connexion guidant l'utilisateur à travers des étapes de calibration (niveau d'études, tranche d'âge, préférence de profil XAI), produisant les métadonnées de personnalisation.
**Fichiers principaux :**
- `apps/web/app/onboarding/page.tsx`
- `apps/web/components/ibis/onboarding/`

### 15. web/datasets
**Description :** Catalogue de datasets avec liste filtrée/facettée, fiche détail (onglets Overview, Aperçu, Fichiers, Guide IA), wizard d'upload multi-étapes, scoring de pertinence pondéré configurable, grille de critères éthiques.
**Fichiers principaux :**
- `apps/web/app/(app)/datasets/`
- `apps/web/components/ibis/datasets/`
- `apps/web/components/ibis/scoring/`
- `apps/web/lib/datasets/`

### 16. web/wizard
**Description :** Wizard ML 9 étapes (dataset → colonne cible → qualité → split → preprocessing → algorithme → hyperparamètres → lancement → résultats), brouillon auto-persisté, shell de navigation avec `MissionStepper`, intégration du copilote challenge.
**Fichiers principaux :**
- `apps/web/app/wizard/`
- `apps/web/components/ibis/wizard/wizard-shell.tsx`
- `apps/web/components/ibis/wizard/steps-1-5.tsx`
- `apps/web/components/ibis/wizard/steps-6-8.tsx`
- `apps/web/lib/wizard/store.ts`

### 17. web/experiments
**Description :** Page de résultats d'expérience avec onglets : Performance (métriques, matrice, courbes, importance — visibilité adaptative par niveau), XAI (explication globale/locale), Équité (fairness), Regards métier (6 disciplines SHS), et dock copilote XAI.
**Fichiers principaux :**
- `apps/web/app/(app)/experiments/[id]/page.tsx`
- `apps/web/components/ibis/experiments/result-charts.tsx`
- `apps/web/components/ibis/experiments/project-experiments-tab.tsx`

### 18. web/xai
**Description :** Copilote d'explication — dock bas ouvrable/fermable (non-modal desktop, plein écran mobile), état mémorisé par expérimentation, réponses riches en blocs JSON structurés (IbisBlocks : tableaux de valeurs, couleurs sémantiques, listes), chat multi-tours asynchrone avec questions suggérées.
**Fichiers principaux :**
- `apps/web/components/ibis/xai/explanation-copilot.tsx`
- `apps/web/components/ibis/xai/explanation-view.tsx`
- `apps/web/components/ibis/xai/ibis-blocks.tsx`
- `apps/web/components/ibis/xai/xai-tab.tsx`
- `apps/web/lib/xai/blocks.ts`

### 19. web/fairness
**Description :** Comparateur d'équité post-hoc — panneau sélectionnant un attribut sensible, affichant les métriques par groupe (taux de sélection, taux de vrais positifs, exactitude, ratios de disparité), avertissement garde-fou causalité.
**Fichiers principaux :**
- `apps/web/components/ibis/fairness/fairness-panel.tsx`
- `apps/web/components/ibis/causal-caveat.tsx`

### 20. web/lenses
**Description :** Feature "Regards métier" — bascule Classique / 6 disciplines SHS (économiste, juriste, politiste, sociologue, historien, éthicien) sur la page résultats. Mêmes chiffres réels, angles d'interprétation différents, rendu déterministe (aucun texte LLM, motif `--ai` absent), bilingue FR/EN.
**Fichiers principaux :**
- `apps/web/components/ibis/lenses/lens-switcher.tsx`
- `apps/web/components/ibis/lenses/lens-reading.tsx`
- `apps/web/lib/lenses/catalog.ts`
- `apps/web/lib/lenses/insights.ts`
- `apps/web/lib/lenses/store.ts`

### 21. web/challenges
**Description :** Missions guidées (6 enquêtes réelles, 4 niveaux : novice → intermédiaire → avancé → expert) avec traceur de quête (`QuestTracker`), étapes objectives (ouvrir dataset, créer projet, entraîner, lire résultats, expliquer), débrief final réel. Progression persistée localStorage.
**Fichiers principaux :**
- `apps/web/app/(app)/challenges/`
- `apps/web/components/ibis/challenges/`
- `apps/web/lib/challenges/catalog.ts`
- `apps/web/lib/challenges/store.ts`
- `apps/web/lib/challenges/progress.ts`

### 22. web/formation
**Description :** Académie IA — cursus structurés (Éveil niveau novice, Fondations niveau débutant — vague 1), leçons en blocs (myth, visual, notion, quiz), glossaire interactif, passeport de compétences avec grades, pont vers les Défis. 100 % front, aucune API.
**Fichiers principaux :**
- `apps/web/app/(app)/formation/`
- `apps/web/components/ibis/formation/lesson-view.tsx`
- `apps/web/components/ibis/formation/cursus-card.tsx`
- `apps/web/lib/formation/catalog.ts`

### 23. web/dashboard
**Description :** Tableau de bord personnel avec tuiles KPI (expériences totales, projets actifs, taux de succès, durée moyenne), timeline d'activité récente, carte mission en cours.
**Fichiers principaux :**
- `apps/web/app/(app)/dashboard/page.tsx`
- `apps/web/components/ibis/dashboard/`

### 24. web/admin
**Description :** Interface d'administration avec gestion des utilisateurs (rôle, activation, crédits), gestion des datasets (validation, templates éthiques), supervision des jobs, pages CRUD dédiées.
**Fichiers principaux :**
- `apps/web/app/(app)/admin/`
- `apps/web/components/ibis/admin/`

---

## Décisions techniques clés

1. **Contrat OpenAPI strict** — FastAPI génère l'OpenAPI complet (Pydantic v2, `extra="forbid"` sur tous les payloads d'écriture) ; `@hey-api/openapi-ts` génère le client TypeScript dans `lib/api/generated/`. La CI échoue si le client commité n'est pas synchronisé (ADR-007).

2. **Auth maison sans IDP tiers** — JWT HS256 + refresh opaque avec rotation à chaque usage et révocation de famille (détection de vol), Google OIDC direct via authlib (tokens Google jamais stockés), hachage Argon2id, rôle en claim JWT (ADR-003).

3. **Temps réel SSE + repli polling** — `GET /jobs/{id}/events` publie la progression via Redis pub/sub ; tous les endpoints de statut restent interrogeables à 2 s. WebSocket non retenu (aucun besoin bidirectionnel, ADR-007).

4. **Reproductibilité P4** — `random_state=42` sur tous les composants (split, modèle, SHAP, LIME, aperçus) ; valeur enregistrée dans les métadonnées d'expérience ; test e2e « double run → diff nulle » (ADR-006).

5. **LLM via OpenRouter exclusivement** — un seul client, une seule clé env (`OPENROUTER_API_KEY`), modèle piloté par `LLM_MODEL`. Anti-hallucination : le prompt ne contient que les vraies valeurs numériques ; post-validation des nombres cités. Fallback déterministe sur toutes les features LLM (ADR-006).

6. **Adaptatif par niveau d'audience** — trois niveaux `XaiAudience` (novice / intermediate / expert) pilotent : profondeur des explications textuelles LLM (~180/250/320 mots), visibilité des blocs de résultats (politique `BLOCK_MIN_AUDIENCE`), ton du chat copilote.

7. **Registre d'algorithmes extensible** — chaque algo = wrapper (`fit/predict/predict_proba/importances/tree_structure`) + schéma d'hyperparamètres Pydantic (source du formulaire dynamique côté web ET de la validation backend). Ajouter un algo = 1 fichier + 1 entrée dans le registre.

8. **Stockage backend agnostique** — `STORAGE_BACKEND=local` (dev, `/data`) ou `s3` (prod) selon env ; même interface `get_storage()` dans le code (ADR-005).

9. **Worker Celery ne recharge pas à chaud** — le conteneur worker partage l'image API mais `--reload` est absent. Toute modification du code des tâches nécessite un redémarrage du conteneur worker.

10. **Regards métier 100 % front déterministe** — les 6 lectures disciplinaires sont construites côté client à partir des vraies métriques (aucun appel LLM, aucun texte inventé) ; le motif visuel `--ai` est délibérément absent pour ne pas mentir sur la nature du contenu.

---

## Évaluation qualité globale

| Critère | État |
|---------|------|
| Tests présents | Oui — 26 fichiers pytest (unit + integration), 17 fichiers Vitest, 3 specs Playwright e2e |
| Structure | Organisée par domaine métier dans les deux apps (modules API + surfaces web cohérentes) |
| Gestion d'erreurs | Centralisée côté API (`ibis/core/errors.py` + structlog JSON) ; côté web via le client généré |
| Documentation | Partielle — 7 ADRs complets, quelques specs dans `docs/`, docstrings Python présentes sur les modules critiques, README public |
| Conventions | Fortes — `[NE PAS REPRODUIRE]` documenté dans les commentaires source, contrat API enforced en CI, seeds YAML idempotents |
