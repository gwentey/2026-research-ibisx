# Spec Technique — web/lenses

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | web/lenses          |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

---

## Architecture du module

La feature est organisée en deux couches :

**Couche logique (`apps/web/lib/lenses/`)**

- `types.ts` — types partagés : `LensId` (union de 6 valeurs), `FeatureImportance`,
  `ResultInsights` (faits extraits), `RawResults` (sous-type structurel de
  `ExperimentResults`).
- `catalog.ts` — registre `LENSES: Record<LensId, LensMeta>` associant chaque
  discipline à une icône Lucide. Exporte aussi `LENS_LIST` pour les itérations.
- `insights.ts` — fonctions pures d'extraction et de détection :
  `prettyFeatureName`, `detectSensitiveFeatures`, `extractInsights`.
- `store.ts` — store Zustand avec middleware `persist` (localStorage, clé
  `ibis:lens`) pour la discipline de profil.

**Couche présentation (`apps/web/components/ibis/lenses/`)**

- `lens-switcher.tsx` — `LensSwitcher` : composant contrôlé (`value`/`onChange`)
  wrappant `ToggleGroup` shadcn/ui. Inclut un item « Classique » en premier.
- `lens-reading.tsx` — `LensReading` : carte de lecture disciplinaire. Construit
  ses `points[]` par branchement `if/else if` sur `lensId`. Affiche les points et
  une section « Angle mort » (champ `caveat` de l'i18n).
- `discipline-selector.tsx` — `DisciplineSelector` : composant autonome (connecté
  au store) pour la page profil. Même ToggleGroup, persistance directe.

**Intégration**

- `apps/web/app/(app)/experiments/[id]/page.tsx` : consommateur principal. Gère
  deux états locaux (`activeLens`, `lensTouched`) pour distinguer la préférence de
  profil et le choix temporaire de la session.
- `apps/web/app/(app)/profile/page.tsx` : expose `DisciplineSelector`.

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/web/lib/lenses/types.ts` | Types partagés du module | ~56 |
| `apps/web/lib/lenses/catalog.ts` | Registre des disciplines (id + icône) | ~30 |
| `apps/web/lib/lenses/insights.ts` | Extraction et détection (pures) | ~126 |
| `apps/web/lib/lenses/store.ts` | Zustand persist (discipline profil) | ~36 |
| `apps/web/components/ibis/lenses/lens-switcher.tsx` | Bascule Classique / discipline | ~48 |
| `apps/web/components/ibis/lenses/lens-reading.tsx` | Carte de lecture disciplinaire | ~125 |
| `apps/web/components/ibis/lenses/discipline-selector.tsx` | Sélecteur profil (store-connected) | ~49 |
| `apps/web/tests/lenses/insights.test.ts` | Tests Vitest (fonctions pures) | ~114 |
| `apps/web/app/(app)/experiments/[id]/page.tsx` | Consommateur principal (intégration) | (partiel) |
| `apps/web/app/(app)/profile/page.tsx` | Surface profil (DisciplineSelector) | (partiel) |
| `apps/web/messages/fr.json` | Contenu textuel FR (clé `lenses.*`) | (partiel) |
| `apps/web/messages/en.json` | Contenu textuel EN (clé `lenses.*`) | (partiel) |

---

## Schéma BDD

Pas applicable. La feature est 100 % front-only. La seule persistance est le
localStorage du navigateur (clé `ibis:lens`, valeur : `{ "discipline": "<LensId> | null" }`).

---

## API / Endpoints

Pas d'API propre. La feature consomme en lecture les données du résultat d'expérience,
fournies par l'endpoint `GET /experiments/{id}/results` (défini dans `api/experiments`).

---

## Patterns identifiés

### Extraction pure et tolérance aux données manquantes

`extractInsights(results: RawResults): ResultInsights` est une fonction pure sans
effet de bord. Elle accepte un objet `RawResults` potentiellement vide et retourne
toujours un `ResultInsights` valide. Chaque accès à une propriété est gardé
(`?? null`, `?? []`, `Array.isArray()`). Cela permet d'appeler la fonction en
`useMemo` même avant que les données API soient chargées.

### Composant contrôlé vs. composant connecté au store

`LensSwitcher` est **contrôlé** (props `value`/`onChange`) : le parent (`page.tsx`)
détient l'état actif et peut distinguer la valeur issue du profil (`storeDiscipline`)
de la valeur choisie manuellement (`lensTouched`). `DisciplineSelector` est à
l'inverse **connecté directement au store** Zustand, car son seul rôle est de persister
la préférence de profil.

### Détection par tokenisation (pas par sous-chaîne)

`detectSensitiveFeatures` découpe chaque nom de variable en tokens alpha-numériques
(`/[^a-z0-9]+/`) après normalisation Unicode (NFD + suppression des diacritiques).
La comparaison est faite sur tokens entiers (listes `exact`) ou par préfixe de token
(`prefix`). Ce choix évite le faux positif `average → age` qu'une recherche par
`includes("age")` produirait.

### Nettoyage des préfixes de transformers sklearn

`prettyFeatureName` cherche le premier `__` dans le nom de variable et renvoie la
partie droite. Cela gère les préfixes standards de `ColumnTransformer` sklearn
(`num__`, `cat__`, `remainder__`). Les noms sans `__` sont retournés intacts.

### Rendu disciplinaire par branchement explicite

`LensReading` construit le tableau `points[]` via des `if / else if` explicites sur
`lensId`. Cette approche est intentionnellement non-extensible via table de dispatch
en V1 : les points de chaque discipline sont de nature hétérogène (certains lisent
`topFeatures`, d'autres lisent `taskType`, d'autres sont fixes). Une abstraction
commune aurait forcé une interface artificielle.

### NoopStorage pour SSR

Le store Zustand inclut un `noopStorage` (objet avec `getItem`/`setItem`/`removeItem`
en no-op) utilisé comme fallback quand `window` n'est pas défini. Cela permet
l'hydratation SSR sans crash Next.js.

---

## Décisions documentées (rejetées pour ADR)

Les décisions suivantes ont été évaluées contre la politique ADR v2.3.0 et rejetées.
Elles sont documentées ici à la place.

**D1 — Regard 100 % déterministe, aucun appel LLM**
La feature ne fait aucun appel LLM et n'utilise aucune génération de texte. Le contenu
des lectures est exclusivement paramétré à partir des vraies métriques. Rejeté Q3=NON :
la décision est confinée à ce module unique. Elle n'implique pas les specs api/llm ou
web/xai de façon contraignante (ces modules ont leur propre politique vis-à-vis du LLM).

**D2 — Absence délibérée du motif visuel `--ai`**
Le composant `LensReading` n'utilise pas le design pattern `--ai` (bordure pointillée,
couleur AI) réservé aux contenus générés par IA. C'est un choix d'honnêteté
pédagogique documenté en commentaire source. Rejeté AP-3 (heuristique
d'implémentation UI / convention de style) + Q3=NON (impact mono-composant).

**D3 — Persistance localStorage, zéro backend**
La préférence de discipline est persistée en localStorage via Zustand persist, sans
aucun appel API. Rejeté AP-2 (configuration d'outil — choix de middleware Zustand
persist) + Q3=NON (décision confinée au store de ce module).

**D4 — LensSwitcher contrôlé (état dans le parent)**
La bascule est un composant contrôlé plutôt qu'un composant gérant son propre état,
pour permettre au parent de distinguer préférence de profil et choix temporaire.
Rejeté AP-3 (heuristique d'implémentation React / pattern composant contrôlé).

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/web/tests/lenses/insights.test.ts` | `prettyFeatureName`, `detectSensitiveFeatures`, `extractInsights` (5 suites, ~15 cas) | Existant |
| Tests composants (`LensReading`, `LensSwitcher`) | — | Absent |
| Tests e2e (navigation bascule) | — | Absent |

Les fonctions pures (`insights.ts`) sont couvertes. Les composants React et le
comportement de persistance localStorage ne sont pas testés.
