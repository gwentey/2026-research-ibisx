# Spec Technique — web/wizard

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | web/wizard          |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

---

## Architecture du module

Le wizard est organisé en trois couches distinctes :

**1. Couche page (`apps/web/app/wizard/page.tsx`)**
Responsable de l'orchestration : chargement parallèle des données, hydratation du
store depuis le brouillon serveur, validation centralisée du bouton « Suivant »
(`canNext`), et persistance du brouillon à chaque avancement d'étape.

**2. Couche coquille (`wizard-shell.tsx`)**
Composant de mise en page pur : rail de navigation gauche (desktop), header sticky
avec `MissionStepper` et `ProgressRing`, navigation compacte mobile, barre de
navigation basse avec boutons Précédent/Suivant. Ne contient aucune logique métier.

**3. Couche étapes (`steps-1-5.tsx`, `steps-6-8.tsx`)**
Composants d'étape individuels, montés conditionnellement sur `store.step`. Chaque
composant lit le store via `useWizardStore()` et écrit directement dans le store via
`store.set()` ou `store.setStrategy()`. Deux fonctions utilitaires sont exportées
depuis `steps-1-5.tsx` et partagées avec `page.tsx` pour la validation centralisée :
- `targetMeta(dataset, quality, state)` — calcule le type recommandé et le statut
  de blocage pour l'étape 2.
- `cleaningBlockingColumns(quality, state)` — retourne la liste des colonnes bloquantes
  à l'étape 3.

**4. Store Zustand (`lib/wizard/store.ts`)**
État global du wizard. Contient toute la configuration de l'expérience en construction.
Deux fonctions de projection sont exportées :
- `serializeDraft(state)` — sérialise uniquement les champs persistables (sans
  `projectId`, `datasetId`, `experimentId`) pour l'envoi au brouillon serveur.
- `toExperimentCreate(state)` — projette l'état complet vers le contrat API
  `ExperimentCreate`, retourne `null` si les champs obligatoires manquent
  (`projectId`, `datasetId`, `targetColumn`, `taskType`, `algorithm`).

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/web/app/wizard/page.tsx` | Page principale : chargement, orchestration, validation `canNext` | ~205 |
| `apps/web/components/ibis/wizard/wizard-shell.tsx` | Coquille de navigation (rail, header, barre basse) | ~260 |
| `apps/web/components/ibis/wizard/steps-1-5.tsx` | Composants étapes 1 à 5 + utilitaires `targetMeta`, `cleaningBlockingColumns` | ~792 |
| `apps/web/components/ibis/wizard/steps-6-8.tsx` | Composants étapes 6 à 8 (algo, hyperparamètres, lancement SSE) | ~582 |
| `apps/web/lib/wizard/store.ts` | Store Zustand + sérialiseurs + projection API | ~141 |

---

## Schéma BDD

Le wizard ne possède pas de tables dédiées. L'état est persisté via le modèle
`Experiment` du backend (`api/experiments`), qui expose un champ `draft_state`
contenant le JSON sérialisé par `serializeDraft()`. La feature consomme les tables
indirectement via les endpoints API.

---

## API / Endpoints consommés

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `GET` | `/datasets/{dataset_id}` | Métadonnées complètes du dataset | JWT |
| `GET` | `/datasets/{dataset_id}/preview` | Aperçu des 10 premières lignes | JWT |
| `GET` | `/datasets/{dataset_id}/quality` | Analyse qualité (score, colonnes, stratégies) | JWT |
| `GET` | `/experiments/algorithms` | Registre des algorithmes disponibles | JWT |
| `GET` | `/experiments/draft` | Lecture du brouillon pour `(project_id, dataset_id)` | JWT |
| `PUT` | `/experiments/draft` (upsert) | Écriture du brouillon | JWT |
| `POST` | `/experiments` | Création et lancement de l'expérience | JWT |
| `GET` | `/experiments/{experiment_id}` | Statut de l'expérience (polling de repli) | JWT |
| `POST` | `/experiments/{experiment_id}/cancel` | Annulation d'un entraînement en cours | JWT |
| `GET` | `/jobs/{job_id}/events` | Flux SSE de progression (EventSource) | JWT/cookie |
| `GET` | `/users/me` | Rafraîchissement du solde crédits après débit | JWT |

---

## Patterns identifiés

### Single source of truth via store Zustand
L'intégralité de la configuration de l'expérience vit dans `useWizardStore`. Les
composants d'étape lisent et écrivent directement dans le store — aucun état local
sauf pour `Step8Launch` qui gère l'état de la console SSE (`LaunchState`, `logs`,
`displayProgress`).

### Validation centralisée en page
La logique `canNext` est calculée dans `WizardInner` (page.tsx), pas dans les
composants d'étape. Cela évite la duplication et assure une cohérence entre le bouton
barre basse et l'éventuelle gestion de navigation directe.

### Fonctions utilitaires pures exportées
`targetMeta` et `cleaningBlockingColumns` sont des fonctions pures exportées de
`steps-1-5.tsx` et réutilisées par `page.tsx` pour la validation. Cette conception
permet de tester la logique métier indépendamment du rendu.

### Projection découplée vers l'API
`toExperimentCreate(state)` est une fonction pure qui traduit l'état du store vers
le contrat API `ExperimentCreate`. Le wizard ne construit jamais le payload inline —
tout passe par cette projection. Retourne `null` si des champs obligatoires sont
absents (garde-fou).

### Pattern AiAssist uniforme
Les recommandations IA sur les étapes 2, 5, 6 et 7 utilisent toutes le composant
`AiAssist` avec les mêmes props (`title`, `guideLabel`, `availableLabel`, `applyLabel`,
`chooseLabel`, `onApply`). Les recommandations sont entièrement déterministes
(heuristiques client-side), sans aucun appel LLM.

### SSE + repli polling (ADR-007)
L'étape 8 consomme l'endpoint `/jobs/{job_id}/events` via `EventSource`. En cas
d'erreur SSE, un polling toutes les 2 secondes prend le relais. Ce pattern est
documenté dans ADR-007 (temps réel SSE + repli polling).

### Reproductibilité random_state=42 (ADR-006)
Le seed `random_state: 42` est injecté de manière fixe dans `toExperimentCreate`,
indépendamment des choix de l'utilisateur. L'étape 4 l'affiche explicitement comme
garantie pédagogique. Ce choix est documenté dans ADR-006 (REPRODUCIBILITY).

### Délai minimum de console (2600 ms)
La constante `MIN_CONSOLE_MS = 2600` impose une durée minimale d'affichage de la
console de traitement. Une animation de progression client-side (ramp 0→92 % sur
~2,5 s, puis SSE peut la dépasser) rend le traitement perceptible même si le worker
termine quasi instantément.

### Intégration QuestTracker via CSS custom property
Le composant `QuestTracker` publie sa hauteur via la variable CSS
`--quest-tracker-height`. `WizardShell` en tient compte dans le padding bas du
`<main>` et dans le positionnement `bottom` de la barre de navigation basse, évitant
tout chevauchement sans communication JS entre composants.

---

## Décisions techniques (non ADR)

### Recommandation algorithme déterministe bornée au registre
La règle de recommandation d'algorithme à l'étape 6 est codée en dur :
`rows < 1000 && cols < 15 ? "decision_tree" : "random_forest"`. Le commentaire
source porte la mention `[NE PAS REPRODUIRE] T8`, indiquant que cette constante
est délibérément liée au registre d'algorithmes déclaré côté backend.

### Suggestion de colonne cible par liste de noms
À l'étape 2, la suggestion automatique de la colonne cible est basée sur une liste
de tokens hardcodés : `["target", "label", "class", "outcome", "species", "quality",
"score", "g3", "survived"]`. Correspondance par `includes()` sur le nom de colonne
en minuscules.

### Heuristique de classification (≤ 10 valeurs distinctes)
La frontière entre « recommander classification » et « recommander régression » pour
une colonne numérique est fixée à 10 valeurs distinctes (`uniqueCount <= 10`).

### Pas de persistence des hyperparamètres sur retour arrière
Le preset et les hyperparamètres sont réinitialisés aux valeurs par défaut de
l'algorithme lors d'un changement d'algorithme à l'étape 6 (`choose()` dans
`Step6Algorithm`). Un retour à l'étape 6 pour changer d'algorithme efface donc les
réglages personnalisés de l'étape 7.

### Chargement parallèle des 5 ressources
Au montage, les 5 appels API (dataset, preview, quality, algorithms, draft) sont
lancés en parallèle via `Promise.all()`. L'UI attend que toutes les ressources soient
disponibles avant d'afficher le wizard (`ready` gate).

### Stratégies de nettoyage filtrées par type de colonne
À l'étape 3, les stratégies numériques (`mean`, `median`, `knn`, `iterative`) ne
sont proposées que pour les colonnes ayant `is_numeric = true`. Les colonnes non
numériques voient uniquement `most_frequent`, `constant`, `drop_rows`, `drop_column`.

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/web/tests/challenges/objective-map.test.ts` | `pathnameToObjectives("/wizard")` → `["create_project"]` ; `coachLocation("/wizard")` → `"at_wizard"` | Existant |
| `apps/web/tests/i18n-messages.test.ts` | Présence des clés i18n wizard (implicite via couverture générale) | Probable |

Aucun test unitaire direct sur `useWizardStore`, `serializeDraft`, `toExperimentCreate`,
`targetMeta` ou `cleaningBlockingColumns` n'a été identifié dans le codebase.

---

## Rapport ADR

### ADR créés

Aucun.

### Candidats rejetés

| Candidat | Raison du rejet | Alternative |
|----------|----------------|-------------|
| `random_state = 42` injecté dans `toExperimentCreate` | Déjà couvert par ADR-006 (REPRODUCIBILITY) — pas une nouvelle décision | Référence à ADR-006 dans cette spec |
| Brouillon serveur persisté à chaque étape validée | Q4 = NON — oublier la règle ne casse pas d'invariant métier ou de sécurité, uniquement un comportement UX | Section « Patterns identifiés » de cette spec |
| Navigation limitée à `maxReachedStep` | Q3 = NON — impact confiné à `web/wizard` uniquement | Section « Patterns identifiés » de cette spec |
| Blocages métier étapes 2 et 3 (régression catégorielle, >30 % manquants) | Q1 = NON — modifiable en touchant un seul composant côté frontend | Section « Décisions techniques (non ADR) » de cette spec |
| AiAssist uniforme sur les 4 étapes | AP-1 (choix de composant interne) + Q3 = NON | Section « Patterns identifiés » de cette spec |
| SSE + polling repli 2 s | Déjà couvert par ADR-007 | Référence à ADR-007 dans cette spec |
| `MIN_CONSOLE_MS = 2600` + ramp animation | AP-4 (workaround local d'UX) | Commentaire dans le code source |
| Recommandation algorithme déterministe (< 1000 lignes / < 15 cols) | AP-3 (heuristique d'implémentation) | Section « Décisions techniques (non ADR) » de cette spec |
