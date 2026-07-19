# Spec Technique — web/formation

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | web/formation       |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

---

## Architecture du module

Le module est structuré en trois couches :

```
lib/formation/          ← logique pure, testable sans React
  types.ts              ← types + constantes (Grade, BlockType, Cursus…)
  catalog.ts            ← catalogue statique (CURSUS[], helpers de lookup)
  progress.ts           ← helpers de progression purs (grade, %, leçon suivante…)
  store.ts              ← Zustand store persisté (lessonsDone, notionsOwned)
  bridge.ts             ← pont formation → défis (slugs référencés)
  glossary.ts           ← index des notions (glossaryEntries, notionLesson)
  badges.ts             ← catalogue de badges + earnedBadges()
  playground.ts         ← données d'illustration des bacs à sable (pures)

components/ibis/formation/
  cursus-card.tsx        ← carte cliquable d'un cursus (vignette domaine + anneau)
  module-card.tsx        ← carte de module listant les leçons
  grade-badge.tsx        ← pastille grade (barres de niveau)
  glossary-term.tsx      ← terme survolable (HoverCard) consommable partout
  lesson-view.tsx        ← moteur de rendu d'une leçon (switch sur BlockType)
  blocks/
    myth-block.tsx        ← B1 — Mythe → Réalité (grille 2 colonnes)
    visual-block.tsx      ← B2 — Explication visuelle (vignette domaine)
    playground-block.tsx  ← B3 — Routeur vers bac à sable selon `kind`
    confusion-playground.tsx ← B3a — Matrice de confusion interactive
    overfitting-playground.tsx ← B3b — Courbes sur-apprentissage
    notion-card-block.tsx ← B4 — Carte-notion (terme/définition/exemple)
    quiz-block.tsx        ← B5 — Quiz éclair (réessai libre, explication)
    case-study-block.tsx  ← B7 — Étude de cas (contexte/problème/leçon)
    practice-block.tsx    ← B8 — Mise en pratique (lien vers Défi réel)

app/(app)/formation/
  page.tsx               ← /formation (accueil académie)
  [cursus]/page.tsx      ← /formation/:cursus (page cursus)
  [cursus]/[lecon]/page.tsx ← /formation/:cursus/:lecon (page leçon)
  glossaire/page.tsx     ← /formation/glossaire (glossaire cherchable)
  passeport/page.tsx     ← /formation/passeport (Passeport IA)
```

La couche `lib/` est indépendante de React et testée unitairement. La couche `components/` est 100 % `"use client"` car elle consomme le store Zustand (localStorage). Les pages sont `"use client"` pour la même raison et utilisent le pattern `mounted` pour éviter les divergences SSR/CSR lors de la lecture du localStorage.

---

## Fichiers impactés

| Fichier | Rôle | Lignes approx. |
|---------|------|----------------|
| `apps/web/lib/formation/types.ts` | Types, constantes (Grade, BlockType, CursusLevel, GRADE_ORDER, XAI_AUDIENCE_BY_LEVEL) | ~84 |
| `apps/web/lib/formation/catalog.ts` | Catalogue structuré (CURSUS[], 4 cursus, 14 modules, 45 leçons) + helpers lookup | ~521 |
| `apps/web/lib/formation/progress.ts` | Helpers de progression purs : grade, %, leçon suivante, notions, rang | ~66 |
| `apps/web/lib/formation/store.ts` | Zustand store persisté localStorage (`ibis:formation`) | ~59 |
| `apps/web/lib/formation/bridge.ts` | Extraction et validation des slugs de Défis référencés | ~26 |
| `apps/web/lib/formation/glossary.ts` | Index des notions triées + lookup par id | ~29 |
| `apps/web/lib/formation/badges.ts` | Catalogue BADGES[] + earnedBadges() | ~24 |
| `apps/web/lib/formation/playground.ts` | Données d'illustration, confusionAt(), confusionMetrics(), overfittingCurve() | ~89 |
| `apps/web/components/ibis/formation/lesson-view.tsx` | Orchestrateur de rendu de leçon (switch BlockType, logique quiz/practice) | ~145 |
| `apps/web/components/ibis/formation/cursus-card.tsx` | Carte cursus avec vignette domaine, anneau, verrou indicatif | ~86 |
| `apps/web/components/ibis/formation/module-card.tsx` | Carte module avec liste de leçons et icônes de statut | ~81 |
| `apps/web/components/ibis/formation/grade-badge.tsx` | Pastille grade (barres de niveau, palette tokens uniquement) | ~33 |
| `apps/web/components/ibis/formation/glossary-term.tsx` | Terme survolable HoverCard, consommable en dehors du module formation | ~46 |
| `apps/web/components/ibis/formation/blocks/myth-block.tsx` | B1 — Mythe/Réalité, côte à côte | ~33 |
| `apps/web/components/ibis/formation/blocks/visual-block.tsx` | B2 — Explication visuelle avec vignette domaine | ~36 |
| `apps/web/components/ibis/formation/blocks/playground-block.tsx` | B3 — Routeur playground selon `kind` | ~18 |
| `apps/web/components/ibis/formation/blocks/confusion-playground.tsx` | B3a — Bac à sable matrice de confusion (seuil, matrice 2×2, métriques) | ~134 |
| `apps/web/components/ibis/formation/blocks/overfitting-playground.tsx` | B3b — Bac à sable sur-apprentissage (courbes SVG, profondeur) | ~117 |
| `apps/web/components/ibis/formation/blocks/notion-card-block.tsx` | B4 — Carte-notion collectionnable | ~27 |
| `apps/web/components/ibis/formation/blocks/quiz-block.tsx` | B5 — Quiz (radio simulé, réessai, explication post-réponse) | ~102 |
| `apps/web/components/ibis/formation/blocks/case-study-block.tsx` | B7 — Étude de cas (contexte/problème/leçon apprise) | ~39 |
| `apps/web/components/ibis/formation/blocks/practice-block.tsx` | B8 — Mise en pratique (marque leçon complète + redirige vers Défi) | ~53 |
| `apps/web/app/(app)/formation/page.tsx` | Accueil académie (grade, progression globale, cartes cursus) | ~94 |
| `apps/web/app/(app)/formation/[cursus]/page.tsx` | Page cursus (bandeau hero domaine, liste modules) | ~89 |
| `apps/web/app/(app)/formation/[cursus]/[lecon]/page.tsx` | Page leçon (validation cohérence cursus↔leçon, délègue à LessonView) | ~34 |
| `apps/web/app/(app)/formation/glossaire/page.tsx` | Glossaire cherchable (filtre temps réel par terme/définition) | ~104 |
| `apps/web/app/(app)/formation/passeport/page.tsx` | Passeport IA (grade, cursus, badges, fingerprint, print) | ~148 |

---

## Schéma BDD (si applicable)

Non applicable. Ce module est 100 % frontend. Aucune table de base de données. La persistance est assurée par `localStorage` via Zustand (clé `ibis:formation`).

Structure persistée :
```json
{
  "lessonsDone": ["string", ...],
  "notionsOwned": ["string", ...]
}
```

---

## API / Endpoints (si applicable)

Non applicable. Ce module n'effectue aucun appel API. Toutes les données sont statiques (catalogue TypeScript + i18n JSON) ou locales (localStorage).

---

## Patterns identifiés

### Pattern "catalogue structure + i18n texte"

Même patron que `lib/challenges/catalog.ts`. Le catalogue TypeScript ne contient que la structure (slugs, types de blocs, ordre, réponses de quiz). Tout le texte lisible (titres, mythes, explications, questions, options, définitions) vit dans `messages/fr.json` et `messages/en.json` sous l'espace de noms `formation.*`. La clé de namespace suit la convention `formation.lessons.<lessonSlug>.<blockId>.<champ>`.

Conséquence : ajouter une langue ne nécessite aucune modification du code TypeScript.

### Pattern noopStorage pour la sécurité SSR

Le store Zustand utilise un `noopStorage` (implémentation vide de `getItem`/`setItem`/`removeItem`) comme fallback quand `window` n'est pas défini (SSR Node.js, environnement de test). Même patron que `lib/challenges/store.ts`. Ceci évite un crash au démarrage sans `if (typeof window !== "undefined")` inline dans chaque composant.

### Pattern "mounted" pour l'hydratation localStorage

Les pages qui lisent le store affichent une progression vide (`[]`) pendant le SSR, puis la vraie progression après montage (`useEffect(() => setMounted(true), [])`). Ceci garantit que l'HTML serveur et le HTML client sont identiques (pas d'erreur d'hydratation React), au prix d'un "flash" où les pourcentages sont à 0 au premier rendu.

### Pattern "helper pur + store séparé"

`progress.ts`, `glossary.ts`, `badges.ts`, `bridge.ts`, `playground.ts` sont des helpers purs sans import React ni Zustand. Ils reçoivent leurs données en paramètre et sont testés unitairement. Le store (`store.ts`) ne contient que l'état et les actions ; il n'a pas de logique de calcul.

### Réutilisation du langage visuel des Défis

`cursus-card.tsx` et la page cursus réutilisent `getDomainVisual()` et `DomainPattern` de `lib/datasets/domain-visuals`. Chaque cursus est associé à un domaine (`research`, `education`, `healthcare`, `finance`) qui détermine la couleur de vignette et le motif SVG de fond.

### Correspondance XAI audience

Le fichier `types.ts` exporte `XAI_AUDIENCE_BY_LEVEL` qui mappe les niveaux de cursus (`novice`, `debutant`, `confirme`) vers les niveaux d'audience XAI du backend (`novice`, `intermediate`, `expert`). Ce mapping est utilisé potentiellement pour personnaliser le copilote XAI en fonction du niveau de l'apprenant (non encore consommé dans le code courant des pages).

---

## Décisions hors ADR (documentées ici)

### Réponse quiz stockée dans le catalogue, pas dans l'i18n

Le champ `answer: number` (index de la bonne réponse) est dans `catalog.ts`, pas dans les fichiers de traduction. Ce choix évite qu'un apprenant inspecte les fichiers i18n pour connaître les réponses à l'avance. Ce n'est pas une contrainte de sécurité forte (le code source est lisible), mais un indicateur d'intention pédagogique.

### Verrou de cursus purement indicatif

La page `/formation` affiche un indicateur "recommandé après…" pour les cursus dont le prérequis n'est pas terminé, mais toutes les routes restent accessibles. Aucune redirection, aucun `notFound()`. Le commentaire dans `cursus-card.tsx` documente explicitement : "P orientation permanente".

### Fingerprint de passeport non cryptographique

Le fingerprint affiché sur le Passeport IA est un hash Java-style (multiplicateur 31) des slugs de leçons terminées, trié alphabétiquement. L'objectif est la reproductibilité de la lecture (même progression = même code), pas la sécurité ni la certifiabilité externe.

### Blocs futurs définis mais non implémentés

Les types `translator` (B6), `tutor` (B9), `ia_vs_you` (B10) sont définis dans `types.ts` mais le `switch` de `lesson-view.tsx` renvoie `null` pour ces cas. Cela permet d'ajouter ces blocs dans le catalogue sans que le code plante, mais ils ne s'affichent pas.

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/web/tests/formation/badges.test.ts` | `earnedBadges()` : badges gagnés selon les leçons complètes | Existant |
| `apps/web/tests/formation/bridge.test.ts` | Tous les slugs référencés par des blocs "practice" existent dans `CHALLENGES` | Existant |
| `apps/web/tests/formation/catalog.test.ts` | Unicité des slugs, cohérence `order`, structure des blocs | Existant |
| `apps/web/tests/formation/glossary.test.ts` | `glossaryEntries()` et `notionLesson()` : toutes les notions pointent vers une leçon existante | Existant |
| `apps/web/tests/formation/i18n-coverage.test.ts` | Toutes les clés de traduction exigées par le catalogue existent dans `fr.json` et `en.json` | Existant |
| `apps/web/tests/formation/playground.test.ts` | `confusionAt()`, `confusionMetrics()`, `overfittingCurve()` : comportement des fonctions pures | Existant |
| `apps/web/tests/formation/progress.test.ts` | `gradeFor()`, `cursusPercent()`, `moduleDone()`, `nextLesson()`, `cursusComplete()` | Existant |
| `apps/web/tests/formation/store.test.ts` | `completeLesson()` (idempotence, merge des notions), `isLessonDone()`, `reset()` | Existant |
