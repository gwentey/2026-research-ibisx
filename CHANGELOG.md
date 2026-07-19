# Changelog — IBIS-X v2

Refonte complète from scratch (voir [JALONS.md](JALONS.md) et [docs/refonte/](docs/refonte/)).
Un jalon = un incrément livrable ; chaque entrée correspond à un commit `feat: jalon N`.

## Évolution XAI 3 — Explication liée au profil : régénération visible et confirmée (19/07/2026)

- **Bandeau proéminent** sur l'explication quand la vue courante (« Voir en tant que ») diffère
  du niveau de génération : surface IA dégradée, titre « Cette explication est rédigée en vue
  X », corps expliquant la régénération et son coût — impossible de croire qu'on lit le niveau
  courant. Remplace l'ancien encart pointillé discret (`regenerateHint`).
- **Confirmation avant dépense** : le CTA « Regénérer en vue Y (1 crédit) » ouvre désormais un
  dialog rappelant le nouveau calcul et le débit immédiat d'1 crédit — unique chemin de
  régénération (annulable). Libellés FR/EN. Le badge de niveau affiché correspond toujours au
  niveau réellement généré (inchangé), solde rafraîchi via `getMe()` (inchangé).

## Évolution XAI 2 — Explication en blocs riches (19/07/2026)

- **L'« Explication rédigée par l'IA » a le même design que le chat** : génération en
  `BlockDocument` (grammaire de blocs + anti-hallucination + repli déterministe par niveau),
  nouvelle colonne `explanations.text_blocks` (JSONB, migration 0009), exposée dans
  `getExplanationResults` (contrat OpenAPI + client TS régénérés). Le front rend `IbisBlocks`
  (tableaux, callouts, featureImpact) et retombe sur le Markdown de `text_explanation` pour
  les explications antérieures — miroir texte conservé (compat, copie, a11y).
- **Factorisation worker** : boucle LLM commune chat/explication (`_blocks_completion`) +
  repli commun (`_fallback_payload`) ; l'ancien chemin texte plat (`build_prompt`,
  `fallback_text`) est supprimé, son invariant adaptatif vit dans `fallback_document`.

## Évolution XAI 4 — Questions suggérées contextualisées (19/07/2026)

- **Les suggestions citent le vrai modèle** : `getSuggestedQuestions` récupère la dernière
  explication terminée de l'expérience → variable dominante (nom humanisé, colonne seule pour
  un one-hot) + métrique principale, injectées dans des questions templatisées
  (« Pourquoi la variable « Sex » domine-t-elle la prédiction ? », « Un score f1 de 0.732,
  puis-je m'y fier ? »). Toujours **déterministe** (zéro LLM), adapté au profil (novice en
  langage courant), FR/EN ; repli sur les listes génériques sans explication terminée.
  Nouveau helper service `latest_completed_explanation` ; contrat HTTP inchangé.

## Évolution XAI 1 — Nombres lisibles (19/07/2026)

- **Importances en %** : le contexte servi au LLM (explication + chat) présente les importances
  en « part de l'importance affichée » (% entiers, dénominateur = top affiché par les
  graphiques), les métriques et valeurs locales arrondies à 3 décimales, avec consigne « cite
  les nombres tels qu'affichés ». Fini `0.242421` — le modèle dit « ≈ 24 % ».
- **Noms de variables humanisés** (`humanize_feature` + miroir front `lib/xai/features.ts`) :
  `cat__Sex_female` → « Sex = female », `num_median_0__Pclass` → « Pclass » — appliqué au
  contexte LLM, aux replis déterministes (texte + tableau du chat, désormais en « Poids (%) »),
  aux graphiques (importance globale en %, waterfall, comparaison SHAP/LIME) et aux barres
  `featureImpact` (anciens messages inclus).
- **Garde-fou anti-hallucination étendu** : tolérance symétrique ÷100 (contexte « 24 % » →
  « 0,24 » accepté) ; rejets toujours loggués, replis « sans IA » inchangés.

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
