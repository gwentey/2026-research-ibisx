# Changelog — IBIS-X v2

Refonte complète from scratch (voir [JALONS.md](JALONS.md) et [docs/refonte/](docs/refonte/)).
Un jalon = un incrément livrable ; chaque entrée correspond à un commit `feat: jalon N`.

## Import Kaggle par lien + catalogue communautaire (19/07/2026)

Le catalogue plafonnait à 28 datasets parce que chaque entrée exigeait un JSON de métadonnées
enrichies **écrit à la main**. Le téléchargement Kaggle n'était pas le goulot — l'enrichissement
l'était. Cette feature ouvre le catalogue à l'import par n'importe quel contributeur.

- **`POST /datasets/import/kaggle`** — on colle l'URL Kaggle (toutes ses formes : `/data`,
  `?select=`, `/versions/N`, ancienne forme sans `/datasets`, référence nue). Validation et
  déduplication **synchrones** (erreur immédiate sur mauvais lien), téléchargement au worker
  (file `maintenance`, jamais `training` qui est bridée à 1 en production).
- **Client Kaggle `httpx`** (`kaggle_client.py`) au lieu de la CLI `kaggle`, qui n'a jamais été
  installée : la taille se lit sur `totalBytes` **avant** téléchargement, puis se revérifie sur la
  taille **décompressée** (une archive de 2 Mo peut cacher 5 Go). Refus des membres d'archive en
  `../` (zip slip). Auth `Bearer` (`KAGGLE_API_TOKEN`) avec repli Basic legacy.
- **Enrichissement automatique** (`enrichment.py`) — socle déterministe qui tient **sans clé LLM**
  (tags Kaggle → domaines, profilage réel des colonnes → tâche ML, % de manquants mesuré), plus une
  couche IA de confort (objectif en français). Panne LLM, JSON illisible ou hors-format → repli
  silencieux, l'import aboutit quand même.
- **L'IA propose, l'humain assume.** Les 10 critères éthiques restent `NULL` à l'import ; les
  suggestions du modèle vivent dans une colonne séparée (`ethics_suggestions`), filtrées aux seuls
  critères connus et aux seuls booléens, et **ne comptent jamais dans `ethical_score`** tant qu'un
  humain ne les a pas confirmées. `apply_ethical_template=False` sur ce chemin, contrairement à
  l'upload.
- **Attribution + badges** — avatar et pseudo de l'importeur sur la carte catalogue (nouvelle route
  publique `GET /users/{id}/avatar`, image seule), badge **Vérifié** pour le catalogue curé vs
  **Communauté** pour les imports. `is_verified` est une colonne explicite, **non déduite** de
  `created_by IS NULL` : la suppression d'un compte aurait sinon promu des imports en « vérifiés ».
- **Licence opposable** — récupérée, stockée, affichée. Liste conservatrice : ce qui n'est pas
  clairement ouvert (NC, « Other », inconnue) **force le mode privé**, puisque le catalogue public
  redistribue les fichiers.
- **Déduplication à unicité partielle** — `UNIQUE (source_ref) WHERE access = 'public'` : le
  catalogue public n'a jamais de doublon, mais chacun garde le droit à sa copie privée. Une unicité
  globale aurait empêché un second utilisateur d'importer un jeu qu'un premier a gardé pour lui.
- **Écran de validation éthique** (`POST /datasets/{id}/ethics-review`, propriétaire ou admin) —
  ferme la boucle « l'IA propose, l'humain assume » : c'est le **seul** chemin par lequel un critère
  peut devenir vrai et donc peser dans `ethical_score`. La revue est **partielle** (un critère absent
  du payload n'est pas touché : une revue en plusieurs fois n'efface rien), l'utilisateur peut
  **contredire** l'IA, et « ne sait pas » reste un choix valide. Bandeau sur la fiche dataset qui ne
  s'affiche que s'il y a réellement quelque chose à faire, plus une boîte de dialogue tristate
  affichant chaque proposition de l'IA avec sa justification. Logique d'affichage extraite dans
  `lib/datasets/ethics-review.ts` et testée à part, comme le reste du front.
- Migration `0010` (numérotée pour éviter la collision avec le `0009` d'une branche concurrente).
  **292 tests backend + 115 front verts**, build production OK.

## Fix sécurité — plus de lien de réinitialisation en clair dans les logs (19/07/2026)

- **`send_email` sans SMTP ne logge plus le corps de l'email en production.** Le fallback
  « pas de `SMTP_HOST` → on logge tout » (destinataire, sujet, corps) exposait le lien de
  réinitialisation émis par `POST /auth/forgot-password` (valable 1 h) à quiconque lit
  `docker compose logs` : prise de contrôle possible de tout compte ayant demandé un reset.
  `SMTP_HOST` n'étant pas garanti configuré en production (défaut vide), le risque était réel.
- Le fallback verbeux est désormais **conditionné à un environnement non-production**
  (`settings.is_production`) — logger le lien reste pratique en dev. En production sans SMTP,
  seul un avertissement `mailer.not_configured` est émis, avec le `user_id` et **jamais** le
  jeton, le lien ni l'adresse email (ARCH §13 : aucune PII ni secret dans les logs).
- `send_email` accepte un `user_id` optionnel pour tracer l'échec sans PII ; `forgot-password`
  le renseigne. Tests : `tests/unit/test_mailer.py` (le corps n'atteint pas le logger en
  production, le lien reste loggé en dev).

## Pages légales publiques — prérequis validation Google OAuth (19/07/2026)

- **`/legal/privacy` et `/legal/terms`** : politique de confidentialité et conditions
  d'utilisation, publiques (hors `(guest)`, donc sans garde d'authentification — Google exige
  que les liens de l'écran de consentement soient atteignables sans compte). Coquille commune
  `LegalDocument` : header sticky de la landing, sommaire ancré en vis-à-vis sur desktop,
  sections numérotées à ancres stables (`#google`, `#cookies`…). Plan des documents dans
  `lib/legal/documents.ts`, contenu intégralement i18n FR/EN. Les CGU portent les mentions
  légales LCEN (éditeur Zelian SASU, directeur de publication, hébergeur).
- **Contenu établi sur un audit du code, pas sur un modèle générique** : champs réellement
  stockés, cookie `ibis_refresh` et clés `ibis:*` du navigateur, sous-traitants réels
  (Hetzner UE, Google OIDC, OpenRouter), déclaration **Limited Use** exigée par Google, et
  mentions honnêtes des limites — pas d'export RGPD automatisé, datasets publiés qui
  survivent à la suppression du compte, valeurs d'exemple transmises à OpenRouter pour le
  guide IA.
- **Consentement au point d'inscription** (`/register`) et liens en pied de landing.
- **Suppression du code mort Google Analytics** (`lib/ga.ts`, dépendance `react-ga4`, exclusion
  ESLint) : jamais monté dans l'app, mais sa présence contredisait la mention « aucun traceur ».
- Tests : plan ↔ catalogues i18n (titres, corps, listes de même longueur FR/EN) et rendu du
  message riche `legal.consent` — 116 tests verts.

## Retour au tableau de bord depuis /status (19/07/2026)

- **Sortie de cul-de-sac sur `/status`** : la page d'état vit hors du shell applicatif (aucune
  sidebar, aucun header) — un utilisateur connecté qui suivait le lien « État du système » depuis
  la navigation n'avait plus **aucun** chemin de retour. Un lien « Retour au tableau de bord »
  (`BackToAppLink`) s'affiche désormais en tête de page **uniquement pour les utilisateurs de
  l'app** : la session est restaurée via `bootstrapSession()`, ce qui couvre aussi le rechargement
  direct de l'URL (le `document.referrer` est vide après un rechargement et absent des navigations
  client Next). Le visiteur anonyme de la page de statut publique ne voit rien de plus. Libellés
  FR/EN (`status.backToDashboard`).

## Récap de défi réductible (19/07/2026)

- **Débrief de fin d'enquête repliable** (`ChallengeDebrief`) : l'encart de résultats gardait
  toujours ses 4-5 paragraphes pédagogiques à l'écran. Un bouton chevron réduit désormais le récap
  à son en-tête (félicitation + score) tout en gardant les CTA « Défi suivant » / « Tous les défis »
  visibles. La préférence est **globale et persistée** (`debriefCollapsed` dans le store de quête),
  donc elle survit entre défis et sessions. Libellés FR/EN (`debriefCollapse`/`debriefExpand`).

## Rétro-documentation Zelian (19/07/2026)

- **Onboarding framework Zelian** : marker `.zelian/project.json` restauré (réactive les hooks
  d'auto-documentation), Base `.claude/rules/`, stack détectée (`02-stack.md`), index Compass
  `.zelian/compass.json` (24 entrées, 100 % ancrées).
- **Rétro-documentation complète des 24 features** (13 api + 11 web) → **48 specs
  (fonctionnelle + technique) + 24 ADRs RETRO** — et **audit initial** (`docs/quality/` :
  audit, dette technique, plan de remédiation).

## J9 — Finalisation : seed, e2e mission, durcissement (17/07/2026)

- `ibis seed` : admin (env) + 6 datasets réels embarqués, idempotent, **jamais** exécuté au
  boot ; import Kaggle complet documenté (`ibis import-kaggle`).
- **E2E Playwright du parcours mission** (inscription → onboarding → projet →
  recommandations → wizard 9 étapes → entraînement réel → SHAP → chat), exécuté **en FR et
  en EN**, piloté par les fichiers de traduction ; job CI nightly sur compose complet, avec
  rejeu des tests de déterminisme (P4) sur l'image finale.
- **Profil production** : `compose.prod.yml` + Caddy (TLS auto, `/api`→api, `/`→web, SSE
  streampé), en-têtes CSP/HSTS/X-Frame-Options/nosniff, ports internes fermés,
  `restart: unless-stopped`, LOG_LEVEL=INFO forcé, `POSTGRES_PASSWORD` obligatoire.
- Sécurité : scan gitleaks en CI (tout l'historique) avec allowlist des faux positifs du
  template ; **0 vulnérabilité critique/haute** (Next 16.2.6, swiper/react-world-flags
  supprimés, overrides lodash/picomatch/linkify-it) ; pip-audit : 0 vulnérabilité.
- **Purge du template** : 2,3 Mo de routes démo supprimés (`app/dashboard/*` — crypto,
  hôtel, e-commerce…) ; tokens, thème et `components/ui` **intacts** (P6). La carte des
  routes buildées est 100 % IBIS-X.
- Cibles de perf CDC §12.2 mesurées : catalogue 12–117 ms (<300 ms), scoring ~5 ms pour 7
  datasets (<1 s/100), aperçu 176 ms (<3 s), entraînements seed 0,1–0,8 s (<2 min), SHAP
  global 0,2–3,2 s (<30 s).
- Docs finales : README (quickstart + prod + tests), guide VPS (secrets, sauvegardes,
  rotation des clés), script de démo 20 min (persona enseignant).

## J8 — M8 Administration (17/07/2026)

- Module admin : gestion des utilisateurs (rôles, activation, **recharge de crédits**,
  suppression) avec **garde du dernier admin actif** ; rôle revérifié EN BASE à chaque route.
- Templates éthiques par domaine **en base** (CRUD, validés contre la source unique des 10
  critères), appliqués à l'import ET à l'upload sans écraser les valeurs saisies.
- Supervision : table jobs filtrable + santé worker ; relance d'analyse qualité ;
  `audit_events` (migration 0007) trace toute action admin.
- Front : section Administration (visible rôle admin uniquement) — users, datasets,
  templates, jobs. Matrice RBAC admin testée (anonyme 401, user/contributor 403 partout).

## J7 — M7 Dashboard, expériences, landing, états (16/07/2026)

- Dashboard réel : KPIs calculés (taux de réussite absent tant qu'aucune expérience — P1),
  activité récente mixte, reprise de brouillon de wizard.
- Liste globale des expériences (filtres statut/algo, badges vivants), landing publique,
  pages 404/erreur, page /status temps réel.

## J6 — M6 Explicabilité (16/07/2026)

- SHAP TreeExplainer (global/local) et LIME, choix automatique justifié, reconstruction
  déterministe du contexte (re-préprocessing seedé).
- **KPI de fiabilité mesurés** : complétude (axiome <1 %), stabilité (Spearman seeds 42–46),
  fidélité LIME (R²), accord inter-méthodes, parcimonie, temps — absents quand incomputables (P1).
- Texte adaptatif au profil (3 niveaux) via OpenRouter avec validation anti-hallucination
  des nombres et **repli déterministe marqué `is_fallback`** (P2) ; chat XAI asynchrone
  (quota 5 questions, sessions purgées à 24 h).

## J5 — M5 Wizard 9 étapes + worker ML (16/07/2026)

- Wizard 9 étapes (CDC §8) : aperçu, cible/tâche, nettoyage par colonne (8 stratégies
  canoniques), split stratifié, préparation, algorithme (registre fermé arbre/forêt),
  hyperparamètres (presets + schéma Pydantic → formulaire), récap/lancement, console SSE.
- Worker Celery : séquence d'entraînement en 9 points, préprocessing **honnête**
  (`applied` persisté — anti-T1), échecs typés (jamais de repli synthétique — anti-T6),
  quotas/crédits (429/402, remboursement à l'annulation), déterminisme testé (2 runs
  identiques, random_state=42 verrouillé par le type).

## J4 — M4 Projets & recommandations (16/07/2026)

- CRUD projets avec isolation stricte par propriétaire, critères + pondérations
  (3 profils), recommandations scorées décomposées, aperçu live, stepper de mission.

## J3 — M3 Scoring multi-critères (16/07/2026)

- Module de scoring pur et unique (P3) : 12 critères, normalisation dynamique (None exclus
  numérateur ET dénominateur), courbes log, score final pondéré ; heatmap d'exploration.

## J2 — M2 Catalogue de datasets (16/07/2026)

- Modèle de métadonnées complet (10 critères éthiques **tristate**, source unique),
  listing filtrable backend (18 filtres), détail 4 onglets, upload multipart avec analyse
  de colonnes réelle, guide IA par job asynchrone (repli marqué), stockage local Parquet+CSV.

## J1 — M1 Auth, comptes, RBAC (15/07/2026)

- JWT maison (Argon2id, access 30 min en mémoire, refresh rotatif httpOnly avec détection
  de réutilisation par famille), Google OIDC direct (PKCE), rate limiting Redis, RBAC
  user/contributor/admin testé en matrice, onboarding 3 questions, profil, crédits.

## J0 — Socle technique (15/07/2026)

- Monorepo apps/web + apps/api, Docker Compose 5 services (worker = même image que l'api),
  Alembic chaîne unique (verrou advisory), registre central des modèles, framework jobs
  (table + pub/sub Redis → SSE + repli polling), client TypeScript généré depuis OpenAPI
  (aucun fetch manuel — ADR-007), CI bloquante (lint, types, tests, contrat, images), i18n
  FR/EN à parité testée, dark mode — design du template **conservé tel quel**.
