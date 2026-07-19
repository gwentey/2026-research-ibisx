# Spec Technique — web/experiments

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | web/experiments     |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

---

## Architecture du module

La feature `web/experiments` est organisée en deux surfaces :

1. **Page de résultats** (`experiments/[id]/page.tsx`) — composant page Next.js App Router (`"use client"`), point d'entrée unique pour la consultation d'une expérience. Elle orchestre tous les sous-composants et détient l'état de niveau effectif (`effectiveAudience`) et de regard actif (`activeLens`).

2. **Onglet expériences d'un projet** (`project-experiments-tab.tsx`) — composant réutilisé dans la vue projet, affiche la liste des expériences avec statuts en live et la comparaison multi-expériences.

Les composants visuels de résultats (`result-charts.tsx`) sont purement présentationnels : ils reçoivent des données et n'appellent aucune API.

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/web/app/(app)/experiments/[id]/page.tsx` | Page résultats — orchestration, gestion de l'état niveau/regard, rendu multi-onglets | ~490 |
| `apps/web/components/ibis/experiments/result-charts.tsx` | Composants de visualisation : `CompositeScoreCard`, `MetricTile`, `ConfusionMatrix`, `RocCurve`, `PrCurve`, `ImportanceChart`, `TreeView`, `RegressionCharts` | ~465 |
| `apps/web/components/ibis/experiments/project-experiments-tab.tsx` | Liste + comparaison des expériences d'un projet | ~270 |
| `apps/web/components/ibis/mission-stepper.tsx` | Fil de mission (Projet→Dataset→Entraînement→Explication), non cliquable | ~85 |
| `apps/web/components/ibis/challenges/challenge-debrief.tsx` | Encart débrief de défi conditionnel, coche les objectifs quest | ~160 |
| `apps/web/components/ibis/audience/audience-switcher.tsx` | Bascule « Voir en tant que » (novice/intermédiaire/expert) | ~50 |
| `apps/web/components/ibis/audience/audience-warning.tsx` | Garde-fou contextuel (niveau effectif ≠ profil) | ~60 |
| `apps/web/components/ibis/audience/advanced-details.tsx` | Accordéon « Détails avancés » pour les blocs repliés | ~35 |
| `apps/web/lib/audience/policy.ts` | Table `BLOCK_MIN_AUDIENCE`, `isBlockVisible`, `compareAudience` — politique de révélation progressive | ~50 |
| `apps/web/tests/audience/policy.test.ts` | Tests Vitest de la politique de révélation (4 cas) | ~35 |

### Composants délégués (autres features)

| Composant | Feature source | Rôle dans experiments |
|-----------|----------------|----------------------|
| `XaiTab` | web/xai | Onglet explicabilité complet (génération + historique + copilote) |
| `FairnessPanel` | web/fairness | Onglet équité |
| `CausalCaveat` | web/fairness | Garde-fou causalité sur l'importance des variables |
| `LensSwitcher` / `LensReading` | web/lenses | Bascule et affichage du regard disciplinaire |

---

## Schéma BDD (si applicable)

Cette feature est 100 % frontend. Elle consomme les endpoints API sans modifier de données en base, à l'exception de :
- `useQuestStore` (Zustand + localStorage) — progression des défis
- `useLensStore` (Zustand + localStorage) — préférence de regard métier

---

## API / Endpoints consommés

| Méthode | Route | Composant consommateur | Auth |
|---------|-------|----------------------|------|
| GET | `/experiments/{id}` | `page.tsx` | JWT |
| GET | `/experiments/{id}/results` | `page.tsx` | JWT |
| GET | `/experiments/{id}/logs` | `page.tsx` | JWT |
| GET | `/experiments/{id}/model` (blob) | `page.tsx` (download) | JWT |
| GET | `/projects/{id}/experiments` | `project-experiments-tab.tsx` | JWT |
| DELETE | `/experiments/{id}` | `project-experiments-tab.tsx` | JWT |
| POST | `/experiments/compare` | `project-experiments-tab.tsx` | JWT |
| POST | `/experiments/{id}/explanations` | `XaiTab` | JWT |
| GET | `/experiments/{id}/explanations` | `XaiTab`, `ChallengeDebrief` | JWT |
| GET | `/explanations/{id}/results` | `XaiTab` | JWT |
| GET | `/experiments/{id}/test-instances` | `XaiTab` | JWT |
| GET | `/jobs/{id}/events` (SSE) | `XaiTab` | JWT |
| GET | `/users/me` | `XaiTab` (rechargement crédits) | JWT |

---

## Patterns identifiés

### Révélation progressive (BLOCK_MIN_AUDIENCE)
Chaque bloc de résultats est déclaré dans `BLOCK_MIN_AUDIENCE` avec son niveau minimum. La fonction `isBlockVisible` partitionne les blocs en deux listes : `visibleBlocks` (rendus en flux) et `advancedBlocks` (passés à `<AdvancedDetails>` = Collapsible). Invariant P1 : les blocs avancés ne sont jamais supprimés du DOM, seulement repliés.

### Niveau effectif éphémère vs profil persisté
Le niveau effectif (`effectiveAudience`) est un état local React initialisé depuis `xai_audience` du profil. La surcharge est autorisée mais éphémère : l'état `audienceTouched` permet de distinguer « l'utilisateur a basculé manuellement » de « le profil vient de charger ». Le niveau effectif est transmis au backend lors de la génération XAI (corps de la requête `audience`).

### Regard métier orthogonal au niveau
`activeLens` (LensId | null) et `effectiveAudience` sont deux dimensions indépendantes de l'état de la page. Le regard métier filtre l'interprétation des mêmes métriques réelles ; le niveau filtre les blocs techniques affichés. Ils ne s'influencent pas mutuellement.

### Chargement parallèle des données
`Promise.all([getExperiment, getExperimentResults, getExperimentLogs])` charge les trois sources en parallèle à l'initialisation. L'état passe `loading → ready | error` en une seule transition.

### Polling vivant dans ProjectExperimentsTab
`setInterval` à 5 000 ms recharge la liste des expériences pour mettre à jour les badges de statut et de progression des expériences en cours. Le timer est nettoyé au démontage du composant.

### Visualisations Recharts via viz_data JSON
Tous les graphiques (`ConfusionMatrix`, `RocCurve`, `PrCurve`, `ImportanceChart`, `RegressionCharts`, `TreeView`) reçoivent leurs données depuis `results.viz_data` — un objet JSON opaque fourni par le backend. Chaque clé (`confusion_matrix`, `roc_curve`, etc.) est extraite à la page, castée, puis passée au composant. Les composants sont purement présentationnels (pas d'appel API).

### Coloration tonale des métriques
`metricTone(key, value)` et `metricRatio(key, value)` implémentent une classification qualitative : les métriques bornées [0,1] (`RATIO_METRIC_KEYS`) obtiennent une tonalité `good/medium/low` basée sur des seuils 0.8 / 0.6 ; les métriques d'erreur (MAE, RMSE…) obtiennent `neutral`. Les couleurs utilisent exclusivement des tokens CSS (`--chart-1`, `--chart-3`, `--chart-4`).

### Confetti-matrix : couleurs sémantiques CSS-only
`ConfusionMatrix` calcule la couleur de chaque cellule via `scoreCellStyle` (diagonale = rampe score verte) et `color-mix(in oklch, var(--destructive) %, var(--card))` (hors-diagonale = rouge sémantique calibré). Aucune couleur en dur : la matrice s'adapte au thème clair/sombre.

### TreeView récursif
`TreeNodeView` est un composant récursif qui rend les nœuds de l'arbre de décision (`split` | `leaf`). La profondeur exportée (`max_depth_exported`) est affichée dans le titre comme information contextuelle.

---

## Configuration

### Ordre des métriques
`METRIC_ORDER` dans `page.tsx` définit l'ordre d'affichage des tuiles de métriques. Les métriques absentes des résultats sont silencieusement ignorées.

### Seuils de tonalité métrique
Dans `result-charts.tsx` : `>= 0.8` → `good`, `>= 0.6` → `medium`, `< 0.6` → `low`. Ces valeurs sont codées en dur dans la fonction `metricTone`.

### Limite de comparaison
Maximum 8 expériences comparables simultanément (codé en dur dans `toggle` de `ProjectExperimentsTab`).

### ImportanceChart
Tronqué aux 15 premières variables (`.slice(0, 15).reverse()`), triées par importance décroissante, affichées dans l'ordre croissant (reverse pour Recharts horizontal).

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/web/tests/audience/policy.test.ts` | `isBlockVisible` (3 niveaux × tous les blocs) + `compareAudience` (same/above/below) | Existant — 4 cas |
| Tests e2e Playwright (`tests/`) | Parcours de mission incluant la page de résultats | Existant (partiel — voir `discovery.md`) |
| Tests unitaires `result-charts.tsx` | Aucun test unitaire dédié aux composants de visualisation | Absent |
| Tests unitaires `page.tsx` | Aucun test unitaire dédié à la logique de partition des blocs | Absent |
