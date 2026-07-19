# Spec Technique — web/challenges

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | web/challenges      |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

---

## Architecture du module

Le module est une **feature d'orchestration pure** : aucune entité backend n'est créée, aucun endpoint dédié n'est consommé en dehors de `listDatasets` et `listExplanations` (endpoints déjà existants). Toute la logique vit côté client.

L'architecture se décompose en quatre couches :

```
lib/challenges/
  types.ts          — types TypeScript + constante XAI_AUDIENCE_BY_LEVEL
  catalog.ts        — catalogue statique de 12 missions (CHALLENGES[])
  progress.ts       — helpers purs de progression (sans état)
  objective-map.ts  — mapping URL → objectifs franchis + emplacement coach
  resolve-dataset.ts — résolution slug → UUID via API listDatasets
  store.ts          — Zustand store + persist localStorage

components/ibis/challenges/
  challenge-card.tsx          — carte de défi (catalogue)
  challenge-briefing.tsx      — page de briefing d'une enquête
  challenge-debrief.tsx       — encart débrief dans la page de résultats
  quest-tracker.tsx           — barre flottante persistante inter-pages
  use-objective-tracking.ts   — hook : coche les objectifs au changement de pathname
  level-badge.tsx             — pastille de niveau (3 barres de difficulté)

app/(app)/challenges/
  page.tsx           — page catalogue /challenges
  [slug]/page.tsx    — page briefing /challenges/<slug>
```

### Flux principal

1. L'utilisateur ouvre `/challenges` → `ChallengesPage` lit `completed[]` depuis le store.
2. Il clique sur une carte → `ChallengeBriefingPage` pré-résout l'UUID du dataset via `resolveDatasetId`.
3. Il clique « Démarrer » → `start(slug)` est appelé sur le store, puis navigation vers le point d'entrée (fiche dataset ou création de projet) avec `?challenge=<slug>` dans l'URL.
4. Pendant la navigation, `QuestTrackerInner` (via `useObjectiveTracking`) écoute les changements de `pathname` et appelle `markObjective` pour chaque objectif correspondant.
5. `QuestTracker` est monté en permanence dans `(app)/layout.tsx` et dans `app/wizard/page.tsx`. Il se réhydrate depuis `?challenge=` si `activeSlug` est null au montage (rechargement ou navigation inter-groupe).
6. Sur la page de résultats, `ChallengeDebrief` vérifie l'appartenance de l'expérience au défi actif, coche `read_results`, puis poll `listExplanations` toutes les 4 s jusqu'à cocher `generate_explanation`.

### Gestion du CSS flottant (`--quest-tracker-height`)

Le traceur publie sa hauteur réelle dans la variable CSS `--quest-tracker-height` via `ResizeObserver`. Les surfaces qui ont un contenu bas (barre de navigation wizard, contenus de pages) réservent cet espace pour que la barre flottante ne cache aucun bouton interactif. À la destruction du composant, la variable est remise à `0px`.

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/web/lib/challenges/types.ts` | Types TypeScript + `XAI_AUDIENCE_BY_LEVEL` | ~44 |
| `apps/web/lib/challenges/catalog.ts` | Catalogue statique des 12 missions | ~157 |
| `apps/web/lib/challenges/progress.ts` | Helpers purs : `isChallengeComplete`, `progressPercent`, `nextObjective` | ~17 |
| `apps/web/lib/challenges/objective-map.ts` | `pathnameToObjectives` + `coachLocation` | ~35 |
| `apps/web/lib/challenges/resolve-dataset.ts` | Résolution `datasetSlug` → UUID via `listDatasets` | ~11 |
| `apps/web/lib/challenges/store.ts` | Zustand store avec persist localStorage (`ibis:challenges`) | ~84 |
| `apps/web/app/(app)/challenges/page.tsx` | Page catalogue `/challenges` | ~72 |
| `apps/web/app/(app)/challenges/[slug]/page.tsx` | Page briefing `/challenges/<slug>` | ~78 |
| `apps/web/components/ibis/challenges/challenge-card.tsx` | Carte de défi avec vignette tonal par domaine | ~68 |
| `apps/web/components/ibis/challenges/challenge-briefing.tsx` | Briefing narratif : contexte, objectifs, récompense, bouton démarrer | ~113 |
| `apps/web/components/ibis/challenges/challenge-debrief.tsx` | Encart débrief dans la page de résultats réels | ~157 |
| `apps/web/components/ibis/challenges/quest-tracker.tsx` | Barre flottante bas, replié/déployé, coaching novice, publication CSS var | ~195 |
| `apps/web/components/ibis/challenges/use-objective-tracking.ts` | Hook : coche les objectifs sur changement de pathname | ~20 |
| `apps/web/components/ibis/challenges/level-badge.tsx` | Pastille niveau : 3 barres de difficulté, tokens uniquement | ~34 |
| `apps/web/app/(app)/layout.tsx` | Intègre `QuestTracker` pour toutes les routes `(app)` | (modifié) |
| `apps/web/app/(app)/experiments/[id]/page.tsx` | Intègre `ChallengeDebrief` | (modifié) |
| `apps/web/app/wizard/page.tsx` | Intègre `QuestTracker` hors groupe `(app)` | (modifié) |

---

## Schéma BDD (si applicable)

Aucun — la feature est 100 % front. La persistance est assurée par `localStorage` (clé : `ibis:challenges`).

Structure persistée :

```json
{
  "state": {
    "activeSlug": "titanic-1912" | null,
    "done": ["open_dataset", "create_project"],
    "completed": ["iris-hello-world"],
    "collapsed": false
  },
  "version": 0
}
```

Les actions Zustand (`start`, `markObjective`, `quit`, `setCollapsed`, `isCompleted`) ne sont pas persistées.

---

## API / Endpoints (si applicable)

La feature ne consomme que des endpoints existants :

| Méthode | Route | Usage | Auth |
|---------|-------|-------|------|
| `GET` | `/datasets?page_size=96` | Résolution `datasetSlug` → UUID (pré-résolution au briefing + lancement) | Bearer |
| `GET` | `/experiments/{id}/explanations` | Polling toutes les 4 s pour cocher `generate_explanation` | Bearer |

---

## Patterns identifiés

- **Catalog pattern** : les 12 missions sont définies comme un tableau TypeScript statique (`CHALLENGES[]`) dans `catalog.ts`. Aucune donnée n'est chargée depuis un backend — le catalogue est livré avec le bundle.
- **Zustand + persist (même patron que `lib/wizard/store.ts`)** : state managé par Zustand avec middleware `persist` et `createJSONStorage` pointant sur `localStorage` (noop storage en SSR/test pour éviter les erreurs).
- **Helpers purs testables isolément** : `progress.ts` et `objective-map.ts` sont sans dépendances React, ce qui les rend directement testables en Vitest sans setup DOM.
- **Repli SSR explicite** : la page `/challenges` utilise `useState(false)` + `useEffect(() => setMounted(true), [])` pour n'afficher la progression localStorage qu'après hydratation côté client, évitant tout mismatch SSR/CSR.
- **ResizeObserver → CSS custom property** : `QuestTracker` publie `--quest-tracker-height` sur `:root` pour que les autres surfaces puissent réserver l'espace sans connaître la barre.
- **Suspense sur `useSearchParams`** : `QuestTracker` est wrappé dans `<Suspense fallback={null}>` car `useSearchParams()` de Next.js requiert une frontière Suspense (même patron que le wizard).

---

## Décisions techniques documentées ici (candidats ADR rejetés)

Les décisions suivantes ont été évaluées contre la politique ADR v2.3.0 et rejetées. Elles sont documentées ici.

### Progression stockée exclusivement en localStorage (aucun backend)

La liste `completed` et le défi `activeSlug` ne sont jamais envoyés à l'API. Côté backend, il n'existe aucune table ni endpoint dédié à la progression des Défis.

**Rejet** : Q3 = NON — la décision est confinée à `web/challenges`. Aucun autre module ne dépend du fait que la progression est locale ou serveur.

**Conséquence** : la progression est perdue si l'utilisateur vide son localStorage ou change de navigateur. Un compte utilisateur peut afficher 0 % alors que l'utilisateur a déjà terminé des missions sur un autre appareil. C'est assumé pour la V1.

### Validation des objectifs par pathname uniquement (pas d'événements synthétiques)

Les objectifs `open_dataset`, `create_project`, `launch_training`, `read_results` sont validés exclusivement via des changements de pathname (`pathnameToObjectives`). Il n'existe pas de callback explicite appelé depuis les features cibles.

**Rejet** : AP-3 (heuristique d'implémentation).

**Conséquence** : si une route est renommée, `pathnameToObjectives` doit être mis à jour en parallèle. Segments protégés : `/datasets/score` et `/datasets/upload` sont explicitement exclus de la règle `open_dataset`.

### Résolution du dataset via `listDatasets?page_size=96`

Pour obtenir l'UUID du dataset d'un défi, `resolveDatasetId` charge jusqu'à 96 datasets et filtre par `dataset_name`. Aucune API de lookup par slug n'est exposée.

**Rejet** : AP-3 (heuristique de contournement d'un manque API).

**Dette** : si le catalogue de datasets dépasse 96 entrées, la résolution peut échouer silencieusement (retourner `null`). La page de briefing affiche alors une toast d'erreur `challenges.resolveError` et bloque le lancement.

### Mapping `XAI_AUDIENCE_BY_LEVEL`

La constante associe chaque niveau de défi à un niveau d'audience XAI : `novice→novice`, `debutant→intermediate`, `confirme→expert`.

**Rejet** : Q1 = NON — le mapping se modifie en 1 ligne dans `types.ts`, sans refactoring transverse.

### `?challenge=<slug>` dans l'URL pour la réhydratation inter-groupes

Le slug du défi actif est propagé dans l'URL lors de la navigation vers le wizard (hors du groupe `(app)`). Le `QuestTrackerInner` lit ce paramètre au montage et rappelle `start(slug)` si le store est vide.

**Rejet** : AP-4 (workaround local lié à la topologie des groupes de routes Next.js).

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/web/tests/challenges/catalog.test.ts` | Invariants du catalogue (datasets seedés, slugs uniques, objectifs, niveaux, lookup, mapping XAI) | Existant |
| `apps/web/tests/challenges/progress.test.ts` | Helpers `isChallengeComplete`, `progressPercent`, `nextObjective` | Existant |
| `apps/web/tests/challenges/objective-map.test.ts` | `pathnameToObjectives` + `coachLocation` sur toutes les routes-clés | Existant |
| `apps/web/tests/challenges/store.test.ts` | Store Zustand : `start`, `markObjective` (idempotence, complétion), `quit`, `setCollapsed`, réinitialisation du traceur | Existant |
| `apps/web/tests/challenges/resolve-dataset.test.ts` | `resolveDatasetId` : match, no-match, data undefined | Existant |
| `apps/web/e2e/challenge.spec.ts` | Parcours e2e FR + EN : bibliothèque → briefing → lancement → traceur actif | Existant |
