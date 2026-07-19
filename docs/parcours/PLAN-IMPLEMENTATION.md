# « Défis » (missions guidées) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une bibliothèque de « Défis » — des missions guidées, datées et gamifiées qui font traverser à l'utilisateur le vrai pipeline IBIS-X (dataset → projet → wizard → entraînement → XAI) et produisent un résultat réel.

**Architecture:** Feature d'orchestration 100 % `apps/web`, zéro backend. Un catalogue statique typé (`lib/challenges/`) + un store Zustand de quête + un traceur persistant qui coche des objectifs sur de **vraies** transitions du produit, via des liens profonds déjà supportés (`/projects/new?datasetId=…`, `/datasets/[id]`). Progression en `localStorage`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 4 + shadcn/ui, Zustand, next-intl (FR/EN), Vitest (unit), Playwright (e2e). SDK API généré `lib/api/generated`.

## Global Constraints

- **P1 — Aucune donnée/résultat fictif** : les objectifs ne se cochent que sur de vraies actions ; jamais de faux graphe/métrique.
- **P5 — Zéro lien mort** : une carte de défi = un défi réellement jouable, adossé à un dataset seedé.
- **Bilingue strict FR + EN** : toute chaîne dans `messages/fr.json` **et** `messages/en.json`. Aucune chaîne en dur.
- **Design template intouchable** : composer avec tokens + composants existants (`AiAssist`, `MissionStepper`, `ProgressRing`, `DomainPattern`, `primaryDomainVisual`, `Card`, `Badge`). Aucune couleur hors tokens ; `--ai` réservé aux blocs IA ; charts monochromes `chart-N`.
- **Datasets réels** (slug) : `titanic`, `penguins`, `student_performance`, `pima_diabetes`, `wine_quality_red`, `iris`. `DatasetCard.dataset_name === slug` (confirmé : `importer.py:115`). Résolution slug→id via `listDatasets`.
- **Route/vocabulaire** : route `/challenges`, libellé i18n `nav.challenges` = « Défis » (fr) / « Challenges » (en). Namespace i18n `challenges`.
- **Mapping niveau→XAI** : `novice→novice`, `debutant→intermediate`, `confirme→expert` (enum `XaiAudience`).

---

## File Structure

**Créés :**
- `apps/web/lib/challenges/types.ts` — types `ChallengeLevel`, `ObjectiveId`, `Challenge`, `ChallengeProgress`.
- `apps/web/lib/challenges/catalog.ts` — les 6 défis (données, pas de texte : slug dataset, niveau, tâche, objectifs, mode d'entrée).
- `apps/web/lib/challenges/store.ts` — store Zustand de quête (défi actif, objectifs cochés) + persistance localStorage.
- `apps/web/lib/challenges/resolve-dataset.ts` — `resolveDatasetId(slug)` via `listDatasets`.
- `apps/web/lib/challenges/progress.ts` — helpers purs : `objectivesFor(level)`, `isChallengeComplete(...)`.
- `apps/web/app/(app)/challenges/page.tsx` — bibliothèque.
- `apps/web/app/(app)/challenges/[slug]/page.tsx` — briefing / hub.
- `apps/web/components/ibis/challenges/challenge-card.tsx` — carte de défi.
- `apps/web/components/ibis/challenges/challenge-briefing.tsx` — bloc briefing + objectifs + bouton démarrer.
- `apps/web/components/ibis/challenges/quest-tracker.tsx` — overlay persistant.
- `apps/web/components/ibis/challenges/challenge-debrief.tsx` — encart débrief (monté dans la page résultats).
- `apps/web/components/ibis/challenges/level-badge.tsx` — pastille de niveau.
- Tests : `apps/web/tests/challenges/*.test.ts` (catalog, store, progress, resolve) ; `apps/web/e2e/challenge-novice.spec.ts`.

**Modifiés :**
- `apps/web/components/ibis/layout/nav-config.ts` — ajouter l'entrée `challenges` + type.
- `apps/web/messages/fr.json` & `messages/en.json` — `nav.challenges` + namespace `challenges`.
- `apps/web/app/(app)/layout.tsx` — monter `<QuestTracker />`.
- `apps/web/app/wizard/page.tsx` — monter `<QuestTracker />` (wizard hors groupe `(app)`).
- `apps/web/app/(app)/experiments/[id]/page.tsx` — monter `<ChallengeDebrief experimentId=… />` sous condition de défi actif.

---

## LOT A — Fondations & bibliothèque

### Task A1 : Types & catalogue des défis

**Files:**
- Create: `apps/web/lib/challenges/types.ts`, `apps/web/lib/challenges/catalog.ts`
- Test: `apps/web/tests/challenges/catalog.test.ts`

**Interfaces produites :**
```ts
// types.ts
export type ChallengeLevel = "novice" | "debutant" | "confirme";
export type ObjectiveId =
  | "open_dataset" | "create_project" | "launch_training"
  | "read_results" | "generate_explanation";
export type EntryMode = "dataset" | "project_direct"; // où « Démarrer » dépose l'utilisateur
export interface Challenge {
  slug: string;            // slug DU DÉFI (ex. "titanic-1912")
  datasetSlug: string;     // slug DU DATASET seedé (ex. "titanic")
  level: ChallengeLevel;
  domain: string;          // pour le langage visuel (getDomainVisual)
  taskType: "classification" | "regression";
  objectives: ObjectiveId[];
  entryMode: EntryMode;
  order: number;           // ordre d'affichage dans son niveau
}
export const XAI_AUDIENCE_BY_LEVEL: Record<ChallengeLevel, "novice" | "intermediate" | "expert"> = {
  novice: "novice", debutant: "intermediate", confirme: "expert"
};
```

```ts
// catalog.ts — 6 défis. Objectifs croissants avec le niveau.
import type { Challenge } from "./types";
export const CHALLENGES: Challenge[] = [
  { slug: "titanic-1912", datasetSlug: "titanic", level: "novice", domain: "social",
    taskType: "classification", entryMode: "dataset", order: 1,
    objectives: ["open_dataset","create_project","launch_training","read_results"] },
  { slug: "penguins-antarctique", datasetSlug: "penguins", level: "novice", domain: "biology",
    taskType: "classification", entryMode: "dataset", order: 2,
    objectives: ["open_dataset","create_project","launch_training","read_results"] },
  { slug: "eleves-decrochage", datasetSlug: "student_performance", level: "debutant", domain: "education",
    taskType: "classification", entryMode: "project_direct", order: 1,
    objectives: ["create_project","launch_training","read_results","generate_explanation"] },
  { slug: "depistage-diabete", datasetSlug: "pima_diabetes", level: "debutant", domain: "healthcare",
    taskType: "classification", entryMode: "project_direct", order: 2,
    objectives: ["create_project","launch_training","read_results","generate_explanation"] },
  { slug: "noter-un-vin", datasetSlug: "wine_quality_red", level: "confirme", domain: "business",
    taskType: "regression", entryMode: "dataset", order: 1,
    objectives: ["create_project","launch_training","read_results","generate_explanation"] },
  { slug: "iris-hello-world", datasetSlug: "iris", level: "confirme", domain: "biology",
    taskType: "classification", entryMode: "dataset", order: 2,
    objectives: ["create_project","launch_training","read_results"] },
];
export const getChallenge = (slug: string): Challenge | undefined =>
  CHALLENGES.find((c) => c.slug === slug);
```

- [ ] **Step 1 — Test d'intégrité du catalogue (échoue)** : `apps/web/tests/challenges/catalog.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { CHALLENGES, getChallenge, XAI_AUDIENCE_BY_LEVEL } from "@/lib/challenges/catalog";
import type { Challenge } from "@/lib/challenges/types";

const SEEDED = ["titanic","penguins","student_performance","pima_diabetes","wine_quality_red","iris"];

describe("catalogue de défis", () => {
  it("chaque défi cible un dataset réellement seedé (P5)", () => {
    for (const c of CHALLENGES) expect(SEEDED).toContain(c.datasetSlug);
  });
  it("les slugs de défi sont uniques", () => {
    const slugs = CHALLENGES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
  it("chaque défi a au moins 3 objectifs se terminant par read_results", () => {
    for (const c of CHALLENGES) {
      expect(c.objectives.length).toBeGreaterThanOrEqual(3);
      expect(c.objectives).toContain("read_results");
    }
  });
  it("getChallenge résout par slug", () => {
    expect(getChallenge("titanic-1912")?.datasetSlug).toBe("titanic");
    expect(getChallenge("inexistant")).toBeUndefined();
  });
  it("mappe chaque niveau à une audience XAI", () => {
    expect(XAI_AUDIENCE_BY_LEVEL.confirme).toBe("expert");
  });
});
```
- [ ] **Step 2 — Lancer, vérifier l'échec** : `pnpm vitest run tests/challenges/catalog.test.ts` → FAIL (module introuvable).
- [ ] **Step 3 — Écrire `types.ts` puis `catalog.ts`** (code ci-dessus).
- [ ] **Step 4 — Lancer, vérifier le succès** : `pnpm vitest run tests/challenges/catalog.test.ts` → PASS.
- [ ] **Step 5 — Commit** : `git add apps/web/lib/challenges apps/web/tests/challenges && git commit -m "feat(defis): types + catalogue des 6 missions guidées"`

### Task A2 : Helpers de progression (purs)

**Files:** Create `apps/web/lib/challenges/progress.ts` ; Test `apps/web/tests/challenges/progress.test.ts`

**Interfaces produites :**
```ts
export function isChallengeComplete(objectives: ObjectiveId[], done: ObjectiveId[]): boolean;
export function progressPercent(objectives: ObjectiveId[], done: ObjectiveId[]): number; // 0..100
export function nextObjective(objectives: ObjectiveId[], done: ObjectiveId[]): ObjectiveId | null;
```

- [ ] **Step 1 — Tests (échouent)** :
```ts
import { describe, it, expect } from "vitest";
import { isChallengeComplete, progressPercent, nextObjective } from "@/lib/challenges/progress";
const objs = ["create_project","launch_training","read_results"] as const;
describe("progression", () => {
  it("incomplet tant qu'il manque un objectif", () => {
    expect(isChallengeComplete([...objs], ["create_project"])).toBe(false);
  });
  it("complet quand tous les objectifs y sont (ordre indifférent)", () => {
    expect(isChallengeComplete([...objs], ["read_results","create_project","launch_training"])).toBe(true);
  });
  it("pourcentage arrondi", () => {
    expect(progressPercent([...objs], ["create_project"])).toBe(33);
  });
  it("prochain objectif = premier non fait", () => {
    expect(nextObjective([...objs], ["create_project"])).toBe("launch_training");
    expect(nextObjective([...objs], [...objs])).toBeNull();
  });
});
```
- [ ] **Step 2 — Vérifier l'échec** : `pnpm vitest run tests/challenges/progress.test.ts` → FAIL.
- [ ] **Step 3 — Implémenter `progress.ts`** :
```ts
import type { ObjectiveId } from "./types";
export function isChallengeComplete(objectives: ObjectiveId[], done: ObjectiveId[]): boolean {
  return objectives.every((o) => done.includes(o));
}
export function progressPercent(objectives: ObjectiveId[], done: ObjectiveId[]): number {
  if (objectives.length === 0) return 0;
  const hit = objectives.filter((o) => done.includes(o)).length;
  return Math.round((hit / objectives.length) * 100);
}
export function nextObjective(objectives: ObjectiveId[], done: ObjectiveId[]): ObjectiveId | null {
  return objectives.find((o) => !done.includes(o)) ?? null;
}
```
- [ ] **Step 4 — Vérifier le succès** : PASS.
- [ ] **Step 5 — Commit** : `git commit -am "feat(defis): helpers purs de progression"`

### Task A3 : Store Zustand de quête (+ persistance localStorage)

**Files:** Create `apps/web/lib/challenges/store.ts` ; Test `apps/web/tests/challenges/store.test.ts`
**Interfaces consommées :** `getChallenge`, `ObjectiveId`. **Produites :**
```ts
export interface QuestState {
  activeSlug: string | null;
  done: ObjectiveId[];
  start(slug: string): void;
  markObjective(id: ObjectiveId): void;
  quit(): void;
  isCompleted(slug: string): boolean; // lu depuis la map de défis terminés persistée
}
export const useQuestStore: UseBoundStore<...>;
```
Persistance : `zustand/middleware` `persist` avec clé `ibis:challenges` (stocke `completed: string[]` — slugs terminés — et l'état courant `activeSlug`/`done`). `start` réinitialise `done=[]`. `markObjective` ajoute sans doublon ; si, après ajout, tous les objectifs du défi actif sont faits → pousse le slug dans `completed`.

- [ ] **Step 1 — Tests (échouent)** — piloter le store hors React :
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useQuestStore } from "@/lib/challenges/store";
beforeEach(() => useQuestStore.setState({ activeSlug: null, done: [], completed: [] } as never));
describe("store de quête", () => {
  it("start active un défi et vide les objectifs", () => {
    useQuestStore.getState().start("titanic-1912");
    expect(useQuestStore.getState().activeSlug).toBe("titanic-1912");
    expect(useQuestStore.getState().done).toEqual([]);
  });
  it("markObjective est idempotent", () => {
    useQuestStore.getState().start("titanic-1912");
    useQuestStore.getState().markObjective("open_dataset");
    useQuestStore.getState().markObjective("open_dataset");
    expect(useQuestStore.getState().done).toEqual(["open_dataset"]);
  });
  it("marque le défi complété quand tous ses objectifs sont faits", () => {
    useQuestStore.getState().start("iris-hello-world"); // create_project, launch_training, read_results
    ["create_project","launch_training","read_results"].forEach((o) =>
      useQuestStore.getState().markObjective(o as never));
    expect(useQuestStore.getState().isCompleted("iris-hello-world")).toBe(true);
  });
  it("quit désactive sans effacer les complétions", () => {
    useQuestStore.getState().start("iris-hello-world");
    ["create_project","launch_training","read_results"].forEach((o) =>
      useQuestStore.getState().markObjective(o as never));
    useQuestStore.getState().quit();
    expect(useQuestStore.getState().activeSlug).toBeNull();
    expect(useQuestStore.getState().isCompleted("iris-hello-world")).toBe(true);
  });
});
```
- [ ] **Step 2 — Vérifier l'échec** → FAIL.
- [ ] **Step 3 — Implémenter le store** (patron `lib/wizard/store.ts` + `persist`). `markObjective` recalcule la complétion via `getChallenge(activeSlug).objectives` + `isChallengeComplete`.
- [ ] **Step 4 — Vérifier le succès** → PASS.
- [ ] **Step 5 — Commit** : `git commit -am "feat(defis): store zustand de quête persistant"`

### Task A4 : Entrée de navigation + i18n de base

**Files:** Modify `apps/web/components/ibis/layout/nav-config.ts`, `messages/fr.json`, `messages/en.json`

- [ ] **Step 1 — nav-config** : étendre l'union `labelKey` avec `"challenges"` et insérer, après Datasets :
```ts
import { SwordsIcon } from "lucide-react";
// dans MAIN_NAV, après { labelKey: "datasets", ... } :
{ labelKey: "challenges", href: "/challenges", icon: SwordsIcon },
```
- [ ] **Step 2 — i18n nav** : ajouter `"challenges": "Défis"` (fr) / `"Challenges"` (en) dans le namespace `nav`.
- [ ] **Step 3 — i18n namespace `challenges` (squelette)** : ajouter dans fr.json **et** en.json un objet `challenges` avec au moins :
```json
"challenges": {
  "title": "Défis",
  "subtitle": "Entraîne-toi sur des cas réels — de la question à l'explication.",
  "levels": { "novice": "Novice", "debutant": "Débutant", "confirme": "Confirmé" },
  "levelHints": {
    "novice": "Sur les rails : l'IA te guide à chaque étape.",
    "debutant": "Copilote : tu fais les choix-clés, l'IA reste dispo.",
    "confirme": "En autonomie : à toi de jouer, on vérifie le résultat."
  },
  "status": { "todo": "À relever", "inProgress": "En cours", "done": "Relevé" },
  "start": "Démarrer l'enquête",
  "progressGlobal": "{done} / {total} défis relevés",
  "objectives": {
    "open_dataset": "Ouvrir la fiche du dataset",
    "create_project": "Créer le projet",
    "launch_training": "Lancer l'entraînement",
    "read_results": "Lire les résultats",
    "generate_explanation": "Générer l'explication"
  },
  "items": {}
}
```
(Le sous-objet `items` recevra briefing/débrief des 6 défis au Lot E.)
- [ ] **Step 4 — Vérifier** : `pnpm --dir apps/web build` compile ; la sidebar affiche « Défis » (contrôle visuel Lot A5).
- [ ] **Step 5 — Commit** : `git commit -am "feat(defis): entrée de navigation + i18n de base FR/EN"`

### Task A5 : Carte de défi + page bibliothèque `/challenges`

**Files:** Create `components/ibis/challenges/level-badge.tsx`, `challenge-card.tsx`, `app/(app)/challenges/page.tsx`
**Interfaces consommées :** `CHALLENGES`, `useQuestStore`, `progress.ts`, `getDomainVisual`, `ProgressRing`.

`level-badge.tsx` : `<LevelBadge level={ChallengeLevel} />` → `Badge` teinté (tokens) + libellé i18n `challenges.levels.<level>`.

`challenge-card.tsx` : `<ChallengeCard challenge={Challenge} completed={boolean} />` — carte cliquable (`Link` vers `/challenges/[slug]`) réutilisant le langage de `dataset-card` : vignette `getDomainVisual(challenge.domain).vignette` + `DomainPattern`, tuile-icône, `LevelBadge`, titre i18n `challenges.items.<slug>.title` (repli : slug), pitch court, statut (`todo`/`done`), tâche. Aucune couleur hors tokens.

`app/(app)/challenges/page.tsx` (client) : en-tête (`title`/`subtitle`) + anneau de progression global (`ProgressRing value=` % de défis complétés, libellé `progressGlobal`), puis **3 sections par niveau** (novice → debutant → confirme), chaque section titrée (`levels.<level>` + `levelHints.<level>`), grille responsive de `ChallengeCard` triées par `order`. État complété lu via `useQuestStore().isCompleted(slug)`.

- [ ] **Step 1 — level-badge + challenge-card** (composition tokens, cf. `dataset-card.tsx:45-75`).
- [ ] **Step 2 — page bibliothèque** (groupement par niveau, tri par `order`).
- [ ] **Step 3 — Build + lint** : `pnpm --dir apps/web build && pnpm --dir apps/web lint` → 0 erreur.
- [ ] **Step 4 — Contrôle visuel** : lancer l'app (voir « Vérification » en fin de plan), se connecter, ouvrir `/challenges` → 6 cartes réparties en 3 niveaux, teintées par domaine, sidebar « Défis » actif.
- [ ] **Step 5 — Commit** : `git commit -am "feat(defis): bibliothèque /challenges (cartes par niveau, progression globale)"`

---

## LOT B — Briefing & lancement (liens profonds)

### Task B1 : Résolveur slug→id de dataset

**Files:** Create `lib/challenges/resolve-dataset.ts` ; Test `tests/challenges/resolve-dataset.test.ts`
**Interface produite :** `async function resolveDatasetId(datasetSlug: string): Promise<string | null>`
Logique : `listDatasets({ query: { page_size: 100 }, throwOnError: false })`, chercher l'item où `dataset_name === datasetSlug`, retourner son `id` (ou `null`).

- [ ] **Step 1 — Test (mock du SDK)** : mocker `@/lib/api/generated` → `listDatasets` renvoie `{ data: { items: [{ id: "uuid-1", dataset_name: "titanic" }] } }` (adapter au champ réel de `DatasetPage` : vérifier `items` vs `data`), asserter `resolveDatasetId("titanic") === "uuid-1"` et `resolveDatasetId("absent") === null`.
- [ ] **Step 2 — Vérifier l'échec** → FAIL.
- [ ] **Step 3 — Implémenter** (confirmer le nom du tableau paginé dans `DatasetPage` via `types.gen.ts` avant d'écrire).
- [ ] **Step 4 — Vérifier le succès** → PASS.
- [ ] **Step 5 — Commit** : `git commit -am "feat(defis): résolution slug→id de dataset"`

### Task B2 : Page briefing `/challenges/[slug]` + lancement

**Files:** Create `components/ibis/challenges/challenge-briefing.tsx`, `app/(app)/challenges/[slug]/page.tsx`
**Interfaces consommées :** `getChallenge`, `resolveDatasetId`, `useQuestStore`, `AiAssist`/`AiAssistPanel`, `MissionStepper`, `router`.

`challenge-briefing.tsx` reçoit `challenge` + textes i18n (`items.<slug>.brief`, `.stakes`, `.reward`), affiche : `LevelBadge`, briefing narratif daté (motif pédagogie visuelle), liste des objectifs (`objectives.<id>`), mini-rappel du dataset (lien `/datasets/[id]` une fois résolu), et bouton **« Démarrer l'enquête »**.

Au clic « Démarrer » : `useQuestStore.start(challenge.slug)`, résoudre `datasetId`, puis router selon `entryMode` :
```ts
if (challenge.entryMode === "project_direct")
  router.push(`/projects/new?datasetId=${id}&datasetName=${challenge.datasetSlug}&challenge=${challenge.slug}`);
else // "dataset"
  router.push(`/datasets/${id}?challenge=${challenge.slug}`);
```
Gérer l'échec de résolution (toast d'erreur, pas de navigation).

- [ ] **Step 1 — challenge-briefing** (composition tokens + `AiAssistPanel` pour le ton pédagogique).
- [ ] **Step 2 — page `[slug]`** : `getChallenge(params.slug)` ; 404 gracieux si inconnu ; charge `datasetId` en effet.
- [ ] **Step 3 — Build + lint** → 0 erreur.
- [ ] **Step 4 — Contrôle** : ouvrir `/challenges/titanic-1912` → briefing lisible ; « Démarrer » atterrit sur `/datasets/<uuid>?challenge=titanic-1912` (dataset Titanic), et pour `eleves-decrochage` sur `/projects/new?...&challenge=eleves-decrochage`.
- [ ] **Step 5 — Commit** : `git commit -am "feat(defis): briefing /challenges/[slug] + lancement par lien profond"`

---

## LOT C — Traceur de quête & détection réelle

### Task C1 : Overlay `QuestTracker`

**Files:** Create `components/ibis/challenges/quest-tracker.tsx` ; Modify `app/(app)/layout.tsx`, `app/wizard/page.tsx`
**Interfaces consommées :** `useQuestStore`, `getChallenge`, `nextObjective`, `progressPercent`, `useSearchParams`, `usePathname`.

Comportement : ne rend rien si pas de défi actif (`activeSlug` null **et** pas de `?challenge=` dans l'URL). Sinon, réhydrate l'actif depuis `?challenge=` si le store est vide (survie au rechargement / passage au wizard hors `(app)`). Affiche un bandeau discret **fixe en bas** (ou en tête de contenu) : titre du défi (`items.<slug>.title`), **objectif courant** (`nextObjective` → `objectives.<id>`), mini-progression (`progressPercent`, style `MissionStepper`), micro-consigne de coach pour niveau `novice` (`items.<slug>.coach.<objectiveId>` si présent), bouton **« Quitter le défi »** (`quit()`). `prefers-reduced-motion` respecté ; masqué à l'impression.

- [ ] **Step 1 — Composant** (tokens + langage `MissionStepper`).
- [ ] **Step 2 — Montage** : ajouter `<QuestTracker />` dans `app/(app)/layout.tsx` (sous le header) **et** dans `app/wizard/page.tsx` (le wizard est hors `(app)`).
- [ ] **Step 3 — Build + lint** → 0 erreur.
- [ ] **Step 4 — Contrôle** : après « Démarrer », le bandeau suit sur `/datasets/[id]`, `/projects/new`, `/wizard`. « Quitter » le fait disparaître.
- [ ] **Step 5 — Commit** : `git commit -am "feat(defis): traceur de quête persistant (app + wizard)"`

### Task C2 : Détection des objectifs sur vraies transitions

**Files:** Create `components/ibis/challenges/use-objective-tracking.ts` (hook) ; câblé dans `QuestTracker`.
Le hook observe le contexte réel et appelle `markObjective` :
- route `/datasets/[id]` visitée avec défi actif → `open_dataset`.
- arrivée sur `/wizard` (projet créé en amont) → `create_project`.
- passage à l'étape 8/9 du wizard **ou** apparition d'un `experimentId` → `launch_training`.
- route `/experiments/[id]` atteinte → `read_results`.
- présence d'un résultat XAI (le débrief signalera aussi) → `generate_explanation`.

**[MUST]** aucune coche sans transition réelle (P1). Où l'info vit déjà : statut d'expérience (page résultats), `listExplanations`. Pour éviter tout couplage fragile, se limiter aux signaux d'URL + un callback léger exposé par la page résultats (Task D1) pour `read_results`/`generate_explanation`.

- [ ] **Step 1 — Hook** : mappe `pathname`/`searchParams` → objectifs, `markObjective` idempotent.
- [ ] **Step 2 — Test unitaire** de la fonction pure de mapping `pathnameToObjective(pathname)` (ex. `/datasets/abc` → `open_dataset`, `/experiments/xyz` → `read_results`).
- [ ] **Step 3 — Vérifier** → PASS + build.
- [ ] **Step 4 — Contrôle** : dérouler un défi novice → les objectifs se cochent dans le bandeau au fil des vraies pages.
- [ ] **Step 5 — Commit** : `git commit -am "feat(defis): détection d'objectifs sur transitions réelles"`

---

## LOT D — Débrief & bouclage

### Task D1 : Encart débrief dans la page résultats

**Files:** Create `components/ibis/challenges/challenge-debrief.tsx` ; Modify `app/(app)/experiments/[id]/page.tsx`
`<ChallengeDebrief experiment={ExperimentWithQueue} results={ExperimentResults|null} />` : ne rend rien si aucun défi actif **ou** si l'expérience n'est pas `succeeded`. Sinon marque `read_results` (et `generate_explanation` si un résultat XAI existe déjà), puis affiche un encart (motif `AiAssist`/pédagogie) : phrase de réussite (`items.<slug>.debrief` avec la vraie métrique primaire injectée), **pont recherche/réel**, actions **« Défi suivant »** (prochain défi non complété) et, pour niveau `confirme`, rappel « Télécharger le modèle » (le bouton existe déjà en tête de page). Marque le défi complété via le store.

- [ ] **Step 1 — Composant** (injecte `results.metrics.primary_metric` réelle — jamais de valeur en dur).
- [ ] **Step 2 — Montage** dans `experiments/[id]/page.tsx` (au-dessus des `Tabs`, sous l'en-tête).
- [ ] **Step 3 — Build + lint** → 0 erreur.
- [ ] **Step 4 — Contrôle** : terminer un entraînement lancé depuis un défi → l'encart débrief apparaît avec la vraie métrique ; « Défi suivant » navigue.
- [ ] **Step 5 — Commit** : `git commit -am "feat(defis): encart débrief dans la page résultats"`

### Task D2 : Persistance & état « terminé » de bout en bout

**Files:** (déjà couvert par le store A3) — vérifier le cycle complet.
- [ ] **Step 1 — Test e2e** `apps/web/e2e/challenge-novice.spec.ts` : login → `/challenges` → ouvrir « Titanic 1912 » → Démarrer → suivre le fil jusqu'aux résultats → asserter présence du débrief → retour `/challenges` → la carte affiche « Relevé ». (S'aligner sur le harnais e2e existant `apps/web/e2e/` et le seed `ibis seed`.)
- [ ] **Step 2 — Lancer** : `pnpm --dir apps/web playwright test e2e/challenge-novice.spec.ts` → PASS.
- [ ] **Step 3 — Commit** : `git commit -am "test(defis): e2e du parcours novice de bout en bout"`

---

## LOT E — Contenu des 6 enquêtes & finition

### Task E1 : Rédaction des 6 enquêtes (FR + EN)

**Files:** Modify `messages/fr.json`, `messages/en.json` — remplir `challenges.items.<slug>` pour les 6 défis :
```json
"titanic-1912": {
  "title": "1912 : qui a survécu, et pourquoi ?",
  "brief": "Nous sommes en avril 1912. …",
  "stakes": "…", "reward": "À la clé : un vrai modèle + son explication.",
  "debrief": "Tu viens d'entraîner un vrai modèle sur des passagers réels… (métrique : {metric}).",
  "coach": { "open_dataset": "Ouvre la fiche Titanic pour découvrir les données.", "create_project": "Clique « Utiliser dans un projet ».", "launch_training": "Applique la recommandation IA à chaque étape, puis lance." }
}
```
(idem pour `penguins-antarctique`, `eleves-decrochage`, `depistage-diabete`, `noter-un-vin`, `iris-hello-world`). Ton daté et à enjeu réel, mais **honnête** (aucune promesse de fausse donnée).
- [ ] **Step 1 — Rédiger les 6 en FR**, **Step 2 — traduire en EN**, **Step 3 — Test i18n parité** (script vérifiant que toute clé `challenges.items.*` existe dans les 2 fichiers), **Step 4 — Commit** : `git commit -am "feat(defis): rédaction des 6 enquêtes FR/EN"`.

### Task E2 : Finition (états, motion, responsive)

- [ ] **Step 1 — État vide** de progression (0 défi relevé) soigné ; état « en cours » repérable.
- [ ] **Step 2 — `prefers-reduced-motion`** respecté sur le tracker et le débrief ; masquage à l'impression.
- [ ] **Step 3 — Responsive** : bibliothèque (grille 1/2/3 col.), bandeau tracker mobile.
- [ ] **Step 4 — Passe finale** : `pnpm --dir apps/web lint && pnpm --dir apps/web build && pnpm --dir apps/web vitest run` tout vert.
- [ ] **Step 5 — Commit** : `git commit -am "feat(defis): finition — états, accessibilité, responsive"`

---

## Vérification (lancer l'app pour les contrôles visuels)

Backend + front via Docker (cf. `docs/demo-20min.md`) : `docker compose up -d && docker compose exec api ibis seed`, front sur http://localhost:3000. Se connecter (admin seedé), puis naviguer `/challenges`. Pour les tests unitaires : `pnpm --dir apps/web vitest run`. Pour l'e2e : `pnpm --dir apps/web playwright test`.

## Self-review (à faire avant de clore)

- **Couverture spec** : bibliothèque (A5) ✓, briefing (B2) ✓, 3 niveaux = guidage (C1 coach + XAI mapping A1) ✓, traceur (C1/C2) ✓, débrief réel (D1) ✓, 6 datasets réels (A1) ✓, honnêteté canicule (aucun faux dataset ; météo = V1.1) ✓, i18n FR/EN (E1) ✓, localStorage (A3) ✓, design tokens (partout) ✓.
- **Pas de placeholder** : les seuils chiffrés du niveau confirmé sont illustratifs dans la copie ; le succès technique = expérience `succeeded` (D1), pas un seuil codé en dur.
- **Cohérence des types** : `ObjectiveId`, `ChallengeLevel`, `Challenge` identiques de A1 à E ; `resolveDatasetId` renvoie `string|null` partout.
