# Spec Technique — web/datasets

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | web/datasets        |
| Version       | 0.2.1               |
| Date          | 2026-07-20          |
| Source        | Rétro-ingénierie + import Kaggle (session 20/07/2026) |

---

## Architecture du module

Le module est composé de 5 routes Next.js App Router et de 3 couches de composants :

```
apps/web/app/(app)/datasets/
├── page.tsx                    ← Catalogue (liste/filtres/tri/pagination)
├── [id]/
│   ├── page.tsx               ← Fiche détail (4 onglets)
│   └── complete/page.tsx      ← Complétion de métadonnées
├── upload/page.tsx            ← Wizard d'import (3 étapes)
└── score/page.tsx             ← Scoring pondéré (heatmap/liste)

apps/web/components/ibis/datasets/
├── dataset-card.tsx           ← Carte catalogue (grille) — +owner, is_verified, source_kind, license_name
├── dataset-attribution.tsx    ← Bloc attribution importeur (avatar + pseudo + source Kaggle)
├── dataset-detail-header.tsx  ← Bandeau fiche détail
├── dataset-how-to-use.tsx     ← Guide pédagogique statique
├── domain-pattern.tsx         ← Motifs SVG par domaine (filigrane)
├── ethical-criteria-grid.tsx  ← Grille 10 critères éthiques
├── ethics-review-banner.tsx   ← Bandeau si des suggestions IA attendent une revue humaine
├── ethics-review-dialog.tsx   ← Dialog tristate revue éthique (proposition IA + justification + choix humain)
├── files-tab.tsx              ← Onglet fichiers + téléchargement
├── filters-sheet.tsx          ← Panneau filtres facettés
├── guide-tab.tsx              ← Onglet guide IA (SSE)
├── kaggle-import-dialog.tsx   ← Dialog import communautaire (coller URL Kaggle + suivi job async)
├── metadata-form.tsx          ← Formulaire métadonnées (3 sections)
├── overview-tab.tsx           ← Onglet aperçu général — +attribution, ethics-review-banner
├── preview-tab.tsx            ← Onglet prévisualisation données
├── upload-dropzone.tsx        ← Zone de dépôt (drag-and-drop)
├── upload-preview-table.tsx   ← Tableau d'aperçu post-analyse
└── upload-stepper.tsx         ← Indicateur d'étapes wizard upload

apps/web/components/ibis/scoring/
├── results-list.tsx           ← Vue liste du scoring
├── score-heatmap.tsx          ← Heatmap datasets × critères
└── weights-panel.tsx          ← Pupitre de pondération

apps/web/lib/datasets/
├── constants.ts               ← ETHICAL_KEYS, SORT_KEYS, PAGE_SIZES, formatCount, scoreColorClass
├── domain-visuals.ts          ← Mapping domaine → visuel (icon, pattern, token chart, monogram)
├── ethics-review.ts           ← Logique d'affichage revue éthique (hasPendingSuggestions, shouldShowBanner)
└── use-catalog.ts             ← Hook useCatalog (state machine catalogue)
```

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/web/app/(app)/datasets/page.tsx` | Catalogue : search, sort, pagination, vue grille/tableau — +bouton import Kaggle (KaggleImportDialog) | ~398 |
| `apps/web/app/(app)/datasets/[id]/page.tsx` | Fiche détail : charge dataset + similaires, orchestre 4 onglets | ~117 |
| `apps/web/app/(app)/datasets/[id]/complete/page.tsx` | Complétion métadonnées : charge, édite, sauvegarde + taux de remplissage | ~189 |
| `apps/web/app/(app)/datasets/upload/page.tsx` | Wizard upload 3 étapes : analyse → aperçu → métadonnées | ~209 |
| `apps/web/app/(app)/datasets/score/page.tsx` | Scoring pondéré : profils, weights, re-scoring debouncé 400 ms | ~141 |
| `apps/web/components/ibis/datasets/dataset-card.tsx` | Carte catalogue : vignette tonale, ProgressRing score éthique, badges — +badge Vérifié/Communauté, attribution owner, licence | ~199 |
| `apps/web/components/ibis/datasets/dataset-attribution.tsx` | Bloc attribution : avatar importeur (`GET /users/{id}/avatar`), pseudo, lien source Kaggle | ~74 |
| `apps/web/components/ibis/datasets/ethics-review-banner.tsx` | Bandeau conditionnel (hasPendingSuggestions) sur la fiche dataset | ~55 |
| `apps/web/components/ibis/datasets/ethics-review-dialog.tsx` | Dialog revue éthique : proposition IA + justification, select tristate, POST ethics-review | ~216 |
| `apps/web/components/ibis/datasets/kaggle-import-dialog.tsx` | Dialog import : saisie URL, validation synchrone, suivi état job (polling), erreurs riches | ~333 |
| `apps/web/components/ibis/datasets/dataset-detail-header.tsx` | Bandeau fiche : stats, download, lien "utiliser dans un projet" | ~207 |
| `apps/web/components/ibis/datasets/ethical-criteria-grid.tsx` | Grille tristate 10 critères éthiques + barre segmentée | ~82 |
| `apps/web/components/ibis/datasets/filters-sheet.tsx` | Panneau Sheet (slide-in) : domaines, tâches, plages numériques, éthique, compteur live | ~323 |
| `apps/web/components/ibis/datasets/guide-tab.tsx` | Guide IA : SSE EventSource, Progress, badge fallback/modèle | ~142 |
| `apps/web/components/ibis/datasets/metadata-form.tsx` | Formulaire 3 sections : TagPicker, TristateSelect, switches | ~363 |
| `apps/web/components/ibis/datasets/overview-tab.tsx` | Onglet Vue d'ensemble : fiche technique, métriques qualité, datasets similaires — +DatasetAttribution, EthicsReviewBanner | ~273 |
| `apps/web/components/ibis/datasets/preview-tab.tsx` | Onglet Aperçu : tableau de données réelles, stats par colonne | ~130 |
| `apps/web/components/ibis/datasets/files-tab.tsx` | Onglet Fichiers : colonnes profiling, PII, téléchargement authentifié | ~109 |
| `apps/web/components/ibis/datasets/upload-dropzone.tsx` | Drag-and-drop (useFileUpload hook), formats acceptés CSV/XLSX/JSON/Parquet, max 100 Mo | ~128 |
| `apps/web/components/ibis/scoring/weights-panel.tsx` | Pupitre : sliders, profils prédéfinis, barre normalisée, critères inactifs en chips | ~187 |
| `apps/web/components/ibis/scoring/score-heatmap.tsx` | Heatmap : DOM natif, en-têtes diagonaux, tri colonne, hover card, clic → détail | ~192 |
| `apps/web/components/ibis/scoring/results-list.tsx` | Vue liste classée du scoring | — |
| `apps/web/lib/datasets/constants.ts` | ETHICAL_KEYS (10 critères), SORT_KEYS, PAGE_SIZES, formatCount, scoreColorClass | ~63 |
| `apps/web/lib/datasets/domain-visuals.ts` | Mapping 9 domaines → {icon, pattern, chartToken, monogram, vignette}, hash déterministe repli | ~164 |
| `apps/web/lib/datasets/use-catalog.ts` | Hook : state machine (loading/ready/error), debounce 300 ms, requestId race-prevention | ~123 |
| `apps/web/lib/datasets/ethics-review.ts` | Utilitaires revue éthique : `hasPendingSuggestions()`, `shouldShowBanner()`, `applyEthicsReview()` | ~45 |

---

## Schéma BDD (si applicable)

Ce module est 100 % frontend. Le schéma BDD est documenté dans `docs/specs/api/datasets/spec-technique.md`. Les types TypeScript utilisés dans ce module sont générés depuis le contrat OpenAPI.

Types principaux consommés depuis `@/lib/api/generated` :
- `DatasetCard` — données carte catalogue (id, display_name, domain, task, ethical_score, instances_number, features_number, global_missing_percentage, split, anonymization_applied, temporal_factors, access, year, num_citations, updated_at, objective) — **+owner, is_verified, source_kind, license_name**
- `DatasetOwner` — `{id, pseudo, avatar_url}` — importeur affiché sur les cartes communautaires
- `DatasetDetail` — données fiche complète (tous les champs de DatasetCard + files, ethical_criteria, ai_guide, completeness, sources, availability, storage_uri, etc.) — **+ethics_suggestions, ethics_reviewed_at, source_ref**
- `KaggleImportRequest` — payload import communautaire (`{url: string, visibility?: string}`)
- `KaggleImportResponse` — réponse import (`{job_id: string, message: string}`)
- `DatasetPage` — réponse paginée du catalogue (items, total, total_pages, page, page_size)
- `DatasetFacets` — facettes disponibles (domains[], tasks[] avec count)
- `SimilarDataset` — paire {dataset: DatasetCard, reason: string}
- `DatasetPreview` — aperçu tabulaire (rows, displayed_columns, total_columns, total_rows, sampled, random_state, column_stats)
- `UploadAnalysis` — résultat du profiling (files[], suggested_name, suggested_domains, suggested_tasks, indicative_quality_score)
- `CompletionStatus` — taux de remplissage (overall_percentage, sections[], needs_human_review[])
- `ScoreResponse` / `ScoredDataset` — résultats de scoring (results[], criteria[])
- `ProfilesResponse` — profils et poids par défaut (profiles[], default_weights, criteria[])

---

## API / Endpoints (si applicable)

| Méthode | Route | Composant | Auth |
|---------|-------|-----------|------|
| GET | `/datasets` | `useCatalog` | Oui (Bearer) |
| GET | `/datasets/facets` | `DatasetsPage` | Oui |
| GET | `/datasets/{id}` | `DatasetDetailPage`, `CompleteMetadataPage` | Oui |
| GET | `/datasets/{id}/similar` | `DatasetDetailPage` | Oui |
| GET | `/datasets/{id}/preview` | `PreviewTab` | Oui |
| GET | `/datasets/{id}/completion` | `CompleteMetadataPage` | Oui |
| POST | `/datasets/{id}/ai-guide` | `GuideTab` | Oui (contributor+) |
| POST | `/datasets/analyze` | `UploadDatasetPage` | Oui (contributor+) |
| POST | `/datasets` | `UploadDatasetPage` | Oui (contributor+) |
| POST | `/datasets/import/kaggle` | `KaggleImportDialog` | Oui (tout compte connecté) |
| POST | `/datasets/{id}/ethics-review` | `EthicsReviewDialog` | Oui (propriétaire ou admin) |
| GET | `/users/{id}/avatar` | `DatasetAttribution` | Non (public) |
| PATCH | `/datasets/{id}` | `CompleteMetadataPage` | Oui (admin ou créateur) |
| GET | `/datasets/{id}/files/{file_id}/download` | `FilesTab`, `DatasetDetailHeader` | Oui |
| GET | `/scoring/profiles` | `ScorePage` | Oui |
| POST | `/scoring/score` | `ScorePage` | Oui |
| GET | `/jobs/{id}/events` | `GuideTab` | Non (SSE public) |

---

## Patterns identifiés

### State machine catalogue (useCatalog)
Le hook `useCatalog` implémente une state machine locale `loading / ready / error` avec prévention des race conditions via un `requestId` incrémental. La recherche est debouncée à 300 ms. Chaque action modifiant les paramètres de filtrage remet la pagination à la page 1.

### Transmission inter-pages via sessionStorage
Les filtres actifs du catalogue sont sérialisés dans `sessionStorage['ibis:score:filters']` avant la navigation vers `/datasets/score`. La page de scoring lit ces filtres au montage. Aucune persistance localStorage (pas de survie à la fermeture de l'onglet).

### Debounce double (catalogue 300 ms / scorer 400 ms)
Le catalogue deboune la recherche textuelle à 300 ms. La page de scoring deboune le re-scoring à 400 ms sur les changements de poids. Le panneau de filtres deboune le compteur live à 300 ms.

### Téléchargement via Blob objectURL
Le téléchargement de fichiers dataset utilise `downloadDatasetFile(..., parseAs: "blob")` puis crée une `objectURL` temporaire attachée à un `<a>` créé dynamiquement. L'URL est révoquée immédiatement après le clic. Le fichier est forcé en `.parquet` quelle que soit l'extension d'origine.

### Heatmap DOM natif avec en-têtes diagonaux
La heatmap de scoring utilise un `<table>` DOM natif (pas de librairie de visualisation). Les en-têtes de colonnes sont rendus en diagonale à -45° via CSS `rotate` et `origin-bottom-left`. La coloration des cellules utilise une rampe définie dans `@/lib/viz/score-scale` (shared avec d'autres modules).

### Domain visual system
9 domaines connus sont mappés statiquement vers {LucideIcon, DomainPatternId, ChartToken, monogram, vignette CSS class}. Les domaines inconnus reçoivent un token chart déterministe via un hash djb2 simplifié. Toutes les classes Tailwind sont écrites littéralement (pas de concaténation dynamique) pour la compatibilité JIT.

### Guide IA avec EventSource
La génération du guide IA ouvre un `EventSource` sur `/api/v1/jobs/{id}/events` après avoir déclenché la génération. Sur l'événement `progress`, si le statut est `completed`, le dataset est rechargé et l'EventSource est fermé. En cas d'erreur SSE (`onerror`), l'EventSource est fermé sans marquer l'état comme échoué.

### Formulaire de métadonnées en 3 sections
Le `MetadataForm` est partagé entre le wizard d'upload (étape 3) et la page de complétion. Les 3 sections (Général, Technique, Éthique) ont des ancres HTML (`id="section-{name}"`) utilisées par la navigation par scroll dans `CompleteMetadataPage`. Le `TristateSelect` encode les valeurs boolean|null en strings "true"/"false"/"null" pour le composant `<Select>`.

---

## Configuration et constantes

| Constante | Valeur | Fichier |
|-----------|--------|---------|
| `MAX_SIZE` upload | 100 Mo | `upload-dropzone.tsx` |
| `ACCEPT` formats | `.csv,.xlsx,.json,.parquet` | `upload-dropzone.tsx` |
| `PAGE_SIZES` catalogue | [12, 24, 48, 96] | `constants.ts` |
| `SORT_KEYS` | [name, year, instances, features, citations, created, updated] | `constants.ts` |
| Debounce recherche | 300 ms | `use-catalog.ts` |
| Debounce live count filtres | 300 ms | `filters-sheet.tsx` |
| Debounce re-scoring | 400 ms | `score/page.tsx` |
| Clé sessionStorage filtres | `ibis:score:filters` | `score/page.tsx` |
| Score ≥ 80 % | vert | `constants.ts` (`scoreColorClass`) |
| Score ≥ 60 % | lime | `constants.ts` |
| Score ≥ 40 % | ambre | `constants.ts` |
| Score < 40 % | rouge | `constants.ts` |

---


## Lecture des erreurs de l'API (`lib/api/errors.ts`)

`apiErrorMessage(error, fallback)` et `apiErrorCode(error)` — deux fonctions pures, testées
dans `tests/api/errors.test.ts`.

**Le piège qu'elles couvrent** : l'API émet du HTTP 422 pour DEUX raisons distinctes, avec
deux formes d'enveloppe incompatibles.

| Enveloppe | Origine | Traitement |
|-----------|---------|------------|
| `{ detail: { code, message } }` | erreurs métier (`ibis.core.errors.error_payload`) | `message` affiché **tel quel** — il est rédigé pour l'utilisateur final |
| `{ detail: [ { loc, msg, type } ] }` | validation de schéma Pydantic (FastAPI) | annote seulement le repli de l'appelant — `field required` / `loc: ["body","url"]` est technique |
| `{ detail: "texte" }` | divers | affiché tel quel |
| autre forme, `null`, `undefined` | — | repli de l'appelant |

**Ne jamais faire `String(error.detail)`** : sur l'enveloppe métier, `detail` est un objet, ce
qui produit littéralement « [object Object] » à l'écran et détruit l'explication du refus.
Ce défaut a été constaté en production sur le dialogue d'import Kaggle. Le test de régression
couvre 11 formes d'enveloppe et vérifie qu'aucune ne peut produire « [object ».

Consommateurs : `kaggle-import-dialog.tsx`, `ethics-review-dialog.tsx`.
`lib/auth/session.ts` conserve son propre extracteur de code (antérieur, périmètre auth).

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|----------------|--------|
| `apps/web/tests/datasets/ethics-review.test.ts` | `hasPendingSuggestions`, `shouldShowBanner`, `applyEthicsReview` dans `ethics-review.ts` | Ajouté (~96 lignes) |
| Tests Playwright e2e | Les 3 specs e2e couvrent le parcours mission (wizard ML) — datasets catalogue et import Kaggle non couverts par e2e | Partiel |

---

## Décisions techniques documentées en spec (non ADR)

### 1. Domain visual system — tokens monochromes + motifs SVG
Le module utilise un système de différenciation visuelle par domaine basé sur les tokens `chart-1..5` du design system (nuances neutres, pas de teintes arbitraires). La distinction entre domaines s'appuie sur la nuance, le motif SVG filigrane et l'icône Lucide — jamais sur une couleur inventée hors du thème. Les 9 domaines connus sont mappés dans `domain-visuals.ts`. Les domaines inconnus reçoivent un visual de repli déterministe par hash. Ce pattern est localisé au module `web/datasets`.

### 2. Transfert inter-pages via sessionStorage (non localStorage)
Le passage des filtres du catalogue vers le scorer utilise `sessionStorage` (données perdues à la fermeture de l'onglet) plutôt que `localStorage` (persistant) ou des query params (URL trop longue avec filtres complexes). Ce choix est intentionnellement éphémère : le contexte de scoring est lié à une session de navigation.

### 3. Formulaire métadonnées partagé entre upload et complétion
`MetadataForm` est un composant contrôlé pur (valeur + onChange) réutilisé dans deux contextes différents. La page d'upload pré-remplit depuis l'analyse, la page de complétion pré-remplit depuis le dataset existant. Ce pattern évite la duplication de logique de formulaire mais impose que MetadataFormValue couvre tous les champs modifiables d'un dataset.

### 4. Heatmap en DOM natif (pas de librairie chart)
La ScoreHeatmap est rendue en `<table>` DOM natif pour garder le contrôle complet sur le tri interactif par colonne, les en-têtes diagonaux CSS, et les tooltips HoverCard/Tooltip de shadcn/ui. L'absence de librairie (D3, Recharts) évite le bridging DOM/React et simplifie la navigation clavier.

### 5. Import Kaggle en dialog avec suivi de job
`KaggleImportDialog` orchestre le flux d'import en deux phases : validation synchrone (l'URL est soumise, les erreurs immédiates — mauvais lien, doublon, licence refusée — remontent directement), puis suivi de job asynchrone (polling sur `/jobs/{id}` jusqu'à `completed` ou `failed`). La dialog reste ouverte et affiche l'avancement ; une erreur de job affiche le message retourné par l'API.

### 6. Revue éthique extraite en lib testable
La logique d'affichage du bandeau et du dialog de revue éthique est extraite dans `lib/datasets/ethics-review.ts` (fonctions pures, sans dépendance React). `hasPendingSuggestions(dataset)` retourne vrai si `ethics_suggestions` contient au moins une proposition et qu'au moins un critère correspondant est encore NULL. `shouldShowBanner(dataset, currentUser)` ajoute la condition d'ownership. Cette extraction permet des tests unitaires sans mock de composant.

### 7. i18n ajoutée pour les nouvelles features
Clés i18n ajoutées dans `messages/fr.json` et `messages/en.json` : `datasets.kaggleImport.*`, `datasets.attribution.*`, `datasets.ethicsReview.*`. Toutes les chaînes visibles dans les nouveaux composants passent par `useTranslations`.
