# Changelog — IBIS-X v2

Refonte complète from scratch (voir [JALONS.md](JALONS.md) et [docs/refonte/](docs/refonte/)).
Un jalon = un incrément livrable ; chaque entrée correspond à un commit `feat: jalon N`.

## Guide IA — Blocs riches et intention annoncée (20/07/2026)

- **Le Guide IA d'un dataset a le même design que le copilote** : génération en `BlockDocument`
  (même contrat `ibis.modules.xai.blocks`, `json_mode` + 2 tentatives + anti-hallucination),
  stocké dans `ai_guide.blocks` (JSONB déjà libre — aucune migration, aucun changement de
  contrat OpenAPI). Le front rend `IbisBlocks` (tableau tonal des colonnes cibles, tuiles
  clé/valeur de la carte d'identité, callout des précautions) et retombe sur le rendu Markdown
  pour les guides générés avant la v2. Miroir texte `text` conservé (copie, a11y, compat).
- **Le repli sans IA garde la richesse visuelle** : `fallback_document` construit les mêmes
  4 sections en blocs à partir des seules métadonnées réelles, badgé « Guide généré sans IA ».
- **Grammaire de blocs partagée et restreignable** (`xai_text.blocks_grammar`) : le guide exclut
  `featureImpact` — un dataset n'a aucun poids de variable calculé, le modèle en inventerait et
  la validation anti-hallucination ignore volontairement les poids.
- **Garde-fou des séparateurs de milliers** : « 4 177 lignes » n'est plus lu comme les nombres
  4 et 177 (`normalize_thousands`), qui faisait basculer en repli des guides pourtant exacts.
- **On sait enfin ce que le bouton va faire** : nouveau bloc `GuideIntro` (motif IA unifié,
  `AiAssistPanel`) affiché AVANT la génération — les 4 sections produites, le bénéfice concret
  (« quoi prédire, avec quelle méthode, ce qui risque de fausser vos résultats »), l'honnêteté
  du procédé et la durée. Replié en une ligne « À quoi sert ce guide ? » une fois le guide
  généré. Clés FR/EN.

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
## Coller un notebook Kaggle marche aussi (20/07/2026)

- **Le cas réel qui bloquait** : on cherche des données, on tombe sur un notebook (c'est ce que
  les moteurs de recherche mettent en avant), on colle son lien — refus. Le message renvoyait à
  un onglet « Data » qui **n'existe pas** sur une page de notebook. Le dataset y figure pourtant,
  sous « Input », mais rien n'indique qu'il faut cliquer dessus pour récupérer son URL.
- **Le notebook est désormais résolu automatiquement** vers le(s) jeu(x) qu'il utilise
  (`kernel_dataset_sources`, endpoint `kernels/pull`). Un seul dataset → import direct, avec la
  mention « ce lien était un notebook, j'ai retrouvé le jeu de données ». Plusieurs → la liste
  est proposée, on ne devine pas à la place de l'utilisateur. Aucun → message décrivant ce qu'il
  **voit réellement** (panneau « Input », clic sur le nom du dataset).
- Le contrat de `kernels/pull` n'étant pas documenté publiquement, le parseur accepte **5 formes
  de charge utile** et **dégrade** (liste vide → message actionnable) sur une forme inconnue,
  plutôt que de casser l'import pour un champ renommé.
- **Quota d'import passé par UTILISATEUR** (20/heure) au lieu de par IP (10/heure). Le limiteur
  par IP se déclenchait dans la suite de tests elle-même — et aurait bloqué une salle de TP
  entière derrière un NAT partagé, les premiers arrivés consommant le quota commun.
  Nouveau `enforce_quota()` dans `ibis.core.ratelimit`, le limiteur par IP restant pour `/auth/*`.

## Erreurs d'API lisibles à l'écran (20/07/2026)

- **« [object Object] » au lieu du message d'erreur.** Le dialogue d'import Kaggle faisait
  `String(error.detail)` sur l'enveloppe `{ code, message }` de l'API : l'utilisateur voyait
  `[object Object]` pendant que le backend produisait une explication précise du refus.
- **Nouveau `lib/api/errors.ts`** (`apiErrorMessage`, `apiErrorCode`) — lit les DEUX formes
  d'enveloppe : `{ detail: { code, message } }` pour les erreurs métier, et
  `{ detail: [ { loc, msg } ] }` pour les erreurs de schéma Pydantic, que FastAPI renvoie
  **aussi en 422**. Les messages métier sont rédigés pour l'utilisateur final et sont donc
  affichés tels quels ; les messages Pydantic, techniques, n'annotent qu'un repli. Test de
  régression sur 11 formes d'enveloppe : aucune ne doit produire « [object ».
- Appliqué au dialogue d'import **et** à celui de revue éthique, qui avait le même défaut.
- **Messages de refus en langage humain** : « Ce lien pointe vers « code », pas vers un
  dataset » devient « Ce lien pointe vers un notebook, pas vers un jeu de données. Ouvre
  l'onglet « Data » de la page… ». Le segment d'URL brut (`code`, `c`, `kernels`) ne disait
  rien à personne. Constaté sur un vrai lien collé en production.

## Import Kaggle ouvert à tout compte connecté (20/07/2026)

- **Le bouton « Importer depuis Kaggle » n'apparaissait pour personne** en dehors des
  contributeurs : il avait été placé derrière le même garde `canUpload` que l'upload libre, et la
  route portait `ContributorDep`. Or un catalogue communautaire dont seuls les contributeurs peuvent
  alimenter n'a rien de communautaire.
- **L'import Kaggle est désormais ouvert à tout compte connecté**, alors que l'upload libre
  (`POST /datasets`) reste réservé aux contributeurs. L'asymétrie est délibérée : l'import est
  strictement plus contraint qu'un upload — source publique identifiée, licence vérifiée, taille
  plafonnée, doublons écartés, attribution nominative, et **aucun octet arbitraire** déposé sur le
  serveur par le client. C'est l'attribution visible qui sert de garde-fou social, pas le rôle.
- **Limiteur par IP** (10 imports/heure, `ibis.core.ratelimit`) : ouvrir l'import à tous exposait
  sinon le stockage et le worker de la VM à des téléchargements en rafale.
- Test de non-régression explicite : ouvrir l'import ne doit **pas** avoir ouvert l'upload libre.
- Règle 15 de `docs/specs/api/datasets/spec-fonctionnel.md` mise à jour en conséquence.

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
