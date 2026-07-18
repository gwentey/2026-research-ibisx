# 07 — Formulaires datasets `/datasets/upload` + `/datasets/[id]/complete`

## Signature visuelle (1 phrase forte + mots-clés)
Un **formulaire-atelier en trois temps** — dépôt, radiographie, fiche d'identité éthique — où chaque section porte une tuile-icône tonale et où le fichier déposé se voit littéralement (aperçu tableau réel) avant d'être décrit. Mots-clés : **zone de dépôt à motif pointillé**, **stepper horizontal compact** (pas de rail — signature distincte du wizard), **sections à tuile-icône**, **aperçu live tabulaire**, **navigation d'ancrage à progression**.

## Disposition cible (wireframe ASCII)

### `/datasets/upload`
```
┌───────────────────────────────────────────────────────────┐
│ [tuile UploadCloud] Ajouter un dataset au catalogue        │
│                     CSV, XLSX, JSON, Parquet — décrivez…   │
│                                                             │
│  ( ● Fichiers )──( ○ Analyse )──( ○ Métadonnées )          │  ← stepper horizontal
├───────────────────────────────────────────────────────────┤
│ STEP 1                                                     │
│ ┌─────────────────────────────────────────────────────┐   │
│ │   · · · · · ·  (motif pointillé SVG en fond, 5%)     │   │
│ │        ⟮ ⬆ ⟯  (icône cerclée bg-background border)    │   │
│ │     Déposez vos fichiers de données                  │   │
│ │     CSV, XLSX, JSON, Parquet — 100 Mo max             │   │
│ │        [ Parcourir… ]                                │   │
│ └─────────────────────────────────────────────────────┘   │
│ (si fichiers) Item-list : [csv-icône] iris.csv  120 Ko [x] │
│                           [Analyser →]                      │
├───────────────────────────────────────────────────────────┤
│ STEP 2  (chart-2)                                           │
│  [chip Fichiers: 1] [chip Lignes: 150] [chip Score: 82/100↑]│
│  ┌ Card fichier ─────────────────────────────────────────┐ │
│  │ [FileSpreadsheet] iris.csv · 150 lignes · 5 col · 0%   │ │
│  │ Colonnes détectées : [sepal_length·float] [species·str]│ │
│  │ Aperçu (5 premières lignes) : ┌──────────────────────┐ │ │
│  │                                 table scrollable réelle│ │
│  └─────────────────────────────────────────────────────┘ │ │
│                              [Passer aux métadonnées →]   │ │
├───────────────────────────────────────────────────────────┤
│ STEP 3  — MetadataForm restylée (3 sections tuile-icône)    │
│  [chart-3] Informations générales                          │
│  [chart-4] Qualité & technique                              │
│  [chart-5] Éthique avancée (+ bandeau pédagogique)          │
│                       [ Créer le dataset ]                  │
└───────────────────────────────────────────────────────────┘
```

### `/datasets/[id]/complete`
```
┌───────────────────────────────────────────────────────────┐
│ [tuile ClipboardCheck] Complétion des métadonnées   [← ]    │
│                        Taux de remplissage…                 │
├───────────────────────────────────────────────────────────┤
│ ┌─ Anneau SVG 72% ─┐  Général      ●━━━━━━━━━ 6/8           │
│ │                  │  Technique    ●━━━━━━     4/7           │
│ │      72%         │  Éthique      ●━━━━       3/10          │
│ └──────────────────┘  (nav d'ancrage → scroll vers section)  │
│  ⚠ À valider par un humain : anonymisation, transparence     │
├───────────────────────────────────────────────────────────┤
│  id="section-general"   [chart-3] Informations générales    │
│  id="section-technical" [chart-4] Qualité & technique        │
│  id="section-ethical"   [chart-5] Éthique avancée            │
│                          [ Enregistrer ]                     │
└───────────────────────────────────────────────────────────┘
```

## Blocs template à reprendre (fichier exact → quoi en extraire)

1. **Zone de dépôt à motif** — `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/dashboard/(auth)/pages/products/create/add-product-form.tsx` lignes 214-297. À extraire : le conteneur piloté par `data-dragging`/`data-files` (`className="... data-[dragging=true]:bg-accent/50 ... rounded-xl border border-dashed ..."`), le badge circulaire `bg-background ... rounded-full border` autour de l'icône (lignes 271-274), le texte "Drop your images here" + bouton outline "Select images" (lignes 276-285), et la grille de fichiers déposés (lignes 248-267, à adapter en liste `Item` puisqu'il n'y a pas d'image à prévisualiser pour du CSV/XLSX). Le hook `useFileUpload` qu'il consomme (`hooks/use-file-upload.ts`, signature `{files, isDragging, errors}` + `{handleDragEnter, handleDragLeave, handleDragOver, handleDrop, openFileDialog, removeFile, getInputProps}`) **existe déjà tel quel dans `apps/web/hooks/use-file-upload.ts`** — à utiliser directement, il remplace le `useState<File[]>` + `onDragOver`/`onDrop` maison de la page v2 actuelle.
2. **Nav d'ancrage à icônes** — `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/dashboard/(auth)/pages/settings/components/sidebar-nav.tsx` lignes 51-77 : `Button variant="ghost"` + icône + libellé, état actif `bg-muted`. À transposer en navigation d'ancrage (scroll vers `#section-general/technical/ethical`) à droite de l'anneau de complétion, avec en plus un badge `{filled}/{total}` par item (le composant source n'a pas ce badge — à ajouter en `ItemActions`).
3. **Tuiles-icône de stat** — `.../hospital-management/components/summary-cards.tsx` lignes 10-25 : le motif `absolute end-4 top-0 flex size-12 items-center justify-center rounded-full` pour l'icône flottante dans un `CardHeader`. À reprendre en **monochrome** (`bg-chart-N/10 text-chart-N` au lieu de `bg-indigo-200`/`bg-green-200`) pour les 3 chips de résumé d'analyse (Fichiers / Lignes / Score) et pour l'anneau de complétion. Le compteur animé `CountAnimation` (`components/ui/custom/count-animation.tsx`, déjà présent dans `apps/web`) habille le score de qualité et le pourcentage global sans inventer de données.
4. **Dialogue d'upload simple (repli)** — `.../apps/file-manager/components/file-upload-dialog.tsx` lignes 73-99 : `dragActive` toggle + liste de fichiers avec bouton `XIcon` de suppression (lignes 100-125). Moins riche que (1), sert de filet si `useFileUpload` s'avère trop contraignant pour le multi-format non-image.
5. **Header à tuile-icône** — `apps/web/components/ibis/wizard/wizard-shell.tsx` lignes 207-219 (le motif `bg-primary/10 text-primary rounded-xl` + icône `size-6` + `h1 text-xl font-semibold tracking-tight` + sous-titre) : référence de qualité à égaler pour l'en-tête des deux pages (icônes `UploadCloudIcon` / `ClipboardCheckIcon`), et le sous-header `ProgressRing` (lignes 45-64) réutilisé pour l'anneau de complétion de `/complete`.
6. **Stepper compact** — `wizard-shell.tsx` lignes 184-203 (pilules `rounded-full border` avec états current/done/locked en tokens `border-primary`/`bg-primary/10`) : à réutiliser comme stepper **horizontal principal** de l'upload (3 pilules Fichiers/Analyse/Métadonnées avec icône + libellé, pas seulement un numéro), volontairement **sans rail latéral** pour rester visuellement distinct du wizard 9 étapes.
7. **Table d'aperçu** — `apps/web/components/ibis/datasets/preview-tab.tsx` lignes 63-103 : le motif `Card className="py-0"` + `Table` scrollable avec en-têtes enrichies (dtype sous le nom de colonne). À réutiliser tel quel pour afficher `analysis.files[i].preview_rows` à l'étape 2 de l'upload — **actuellement non exploité par la page v2** alors que l'API le renvoie déjà.

## Composants ibis à créer / modifier (chemins)

- `apps/web/app/(app)/datasets/upload/page.tsx` — remplacer le bouton-dropzone maison par `useFileUpload` + nouveau composant `UploadDropzone` ; remplacer la barre `Progress` linéaire du haut par le stepper à pilules du wizard ; step 2 : ajouter les 3 chips de résumé + la table d'aperçu par fichier.
- `apps/web/components/ibis/datasets/upload-dropzone.tsx` (nouveau) — zone de dépôt à motif SVG + liste `Item`/`ItemGroup` des fichiers sélectionnés (icône par extension, taille, bouton retirer).
- `apps/web/components/ibis/datasets/upload-stepper.tsx` (nouveau, ou inline) — 3 pilules horizontales (icônes `UploadCloudIcon`, `ScanSearchIcon`, `ClipboardListIcon`), état dérivé de `step`.
- `apps/web/components/ibis/datasets/upload-preview-table.tsx` (nouveau) — table compacte à partir de `UploadFileAnalysis.preview_rows` (5 lignes max, colonnes = `columns[].name`), calquée sur `preview-tab.tsx`.
- `apps/web/components/ibis/datasets/metadata-form.tsx` — restyler les 3 `CardHeader` existants (lignes 133-134, 211-213, 306-309) en tuile-icône (`bg-chart-N/10` + icône lucide + `CardTitle`) ; ajouter des `id` (`section-general`, `section-technical`, `section-ethical`) sur chaque `Card` pour permettre l'ancrage depuis `/complete` ; transformer le bandeau `ethicsHint` (ligne 308) en encart pédagogique visible (icône `InfoIcon`, fond `bg-muted/50 rounded-md p-3`) plutôt qu'un simple `<p>`.
- `apps/web/app/(app)/datasets/[id]/complete/page.tsx` — remplacer la grille de cartes de complétion (lignes 114-127) par : anneau SVG (réutiliser `ProgressRing` du wizard, extrait en `apps/web/components/ibis/progress-ring.tsx` si on veut éviter la dépendance croisée avec `wizard-shell.tsx`) + nav d'ancrage à droite ; transformer le bloc `needs_human_review` (lignes 128-137) en `Alert` (icône `TriangleAlertIcon`) au lieu d'une simple ligne de badges.
- `apps/web/components/ibis/progress-ring.tsx` (nouveau, extraction) — sortir `ProgressRing` de `wizard-shell.tsx` vers un composant partagé (paramétrable en taille) pour l'utiliser aussi dans `/complete`, sans dupliquer le SVG.

## Palette tonale & motifs (mapping chart-1..5 / patterns SVG, en monochrome)

- **Étape 1 — Fichiers** : icône cerclée `bg-chart-1/10 text-chart-1` (le plus sombre = « socle », premier contact avec la donnée). Motif de fond : grille de points SVG locale (`<pattern>` avec cercles `r=1` espacés de 16px, `fill="currentColor" className="text-foreground/5"`) plaquée en fond de la dropzone, sous le contenu (`absolute inset-0 -z-10`).
- **Étape 2 — Analyse** : chips de résumé et anneau du score en `chart-2` (`bg-chart-2/10 text-chart-2`). Motif optionnel : fine ligne de scan répétée (`repeating-linear-gradient` via classe utilitaire existante, ou SVG `<pattern>` de traits horizontaux à `opacity-5`) derrière le bandeau de résumé, pour évoquer la « radiographie » du fichier — à garder discret, un seul motif suffit si le budget de polish est serré.
- **Étape 3 / section Général** (upload + complete) : tuile `bg-chart-3/10 text-chart-3`, icône `IdCardIcon` ou `InfoIcon`.
- **Section Qualité & technique** : tuile `bg-chart-4/10 text-chart-4`, icône `SlidersHorizontalIcon`.
- **Section Éthique avancée** : tuile `bg-chart-5/15 text-foreground border border-chart-5/40` (chart-5 est la nuance la plus claire en thème clair — on ajoute une bordure pour garder le contraste, cf. §6.4 accessibilité), icône `ShieldCheckIcon`. Comme `--chart-5` s'inverse en sombre (`base-300` clair → `base-700` sombre, `app/globals.css` lignes 45 et 94), le contraste reste correct dans les deux thèmes sans intervention.
- **Anneau de complétion `/complete`** : `stroke-primary` sur fond `stroke-border` (identique au `ProgressRing` du wizard) — on ne réinvente pas de couleur, seule la taille change.
- Aucune couleur sémantique (vert/rouge) n'est introduite : la distinction entre sections se fait uniquement par nuance chart-N + icône + libellé, jamais par une teinte inventée.

## Données réelles utilisées (champs du client généré)

- `UploadAnalysis` : `files[].original_filename`, `row_count`, `column_count`, `missing_percentage`, `columns[]` (déjà utilisés) **et `files[].preview_rows`** (non exploité aujourd'hui — c'est la donnée clé du nouvel aperçu tableau), `indicative_quality_score`, `suggested_domains`, `suggested_name`, `suggested_tasks`.
- `DatasetMetadataUpdate` : tous les champs déjà couverts par `MetadataForm` (display_name, year, access, objective, sources, storage_uri, documentation_link, domain[], task[], split, temporal_factors, metadata_provided_with_dataset, external_documentation_available, representativity_level/description, sample_balance_level/description) + les 10 clés éthiques tristate (`ETHICAL_KEYS` dans `apps/web/lib/datasets/constants.ts`).
- `CompletionStatus` : `overall_percentage`, `sections[]` (`name: 'general'|'technical'|'ethical'`, `filled`, `total`, `missing_fields[]`) — mappe directement les 3 items de la nav d'ancrage et leurs badges `filled/total` ; `needs_human_review[]` pour l'alerte pédagogique.

Aucune donnée simulée : le tableau d'aperçu vient de `preview_rows` renvoyé par `analyzeUpload`, pas d'un mock.

## Nouvelles clés i18n (liste fr — l'implémenteur fera en)

Sous `datasets.uploadWizard` (existant, à compléter) :
- `stepperFiles`, `stepperAnalysis`, `stepperMetadata` (libellés courts des pilules, distincts de `step1/2/3` déjà utilisés en fil d'Ariane texte)
- `dropzoneCta` ("Sélectionner des fichiers")
- `previewTitle` ("Aperçu des données")
- `previewRowsCaption` ("{count} premières lignes sur {total}")
- `summaryFiles`, `summaryRows`, `summaryScore` (libellés des 3 chips)
- `removeFile` (aria-label bouton retirer un fichier)
- `sectionGeneral`, `sectionTechnical`, `sectionEthicalAdvanced` (titres de section si distincts des clés `datasets.completion.section.*` déjà existantes — sinon réutiliser ces dernières pour éviter la duplication)

Sous `datasets.completion` (existant, à compléter) :
- `jumpTo` (aria-label de la nav d'ancrage)
- `ring` ou réutiliser `overall` déjà présent pour le centre de l'anneau

Total estimé : **~10-12 nouvelles clés** (beaucoup de libellés existent déjà dans `uploadWizard`/`completion`/`ethics`).

## Risques (e2e, parité i18n, perfs) + parades

- **e2e** : aucun sélecteur de `apps/web/e2e/mission.spec.ts` ne cible `/datasets/upload` ou `/datasets/[id]/complete` (vérifié par grep sur `e2e/`) — **aucun risque direct**. Rester prudent si un test futur cible ces pages : garder les boutons `t("create")` / `tCommon("save")` et le texte `t("title")` stables.
- **Parité i18n** : toute nouvelle clé doit être ajoutée à `fr.json` ET `en.json` (test vitest de parité) — check-list ci-dessus à dupliquer en anglais par l'implémenteur.
- **Perfs** : `preview_rows` peut contenir des valeurs longues/beaucoup de colonnes — limiter l'affichage à 5 lignes et wrapper dans un conteneur `overflow-auto max-h-*` (déjà le pattern de `preview-tab.tsx`) pour éviter un tableau qui explose la mise en page mobile.
- **Régression fonctionnelle** : le remplacement du dropzone maison (état `File[]` local) par `useFileUpload` change la source de vérité des fichiers sélectionnés — bien vérifier que `submit()` (ligne 57-72 de `upload/page.tsx`) continue de recevoir un vrai `File[]` (le hook expose `files[].file` comme `File` natif, à mapper) avant l'appel `createDataset`.
- **Double emploi de `ProgressRing`** : si extrait de `wizard-shell.tsx` vers un composant partagé, vérifier que le wizard continue de fonctionner à l'identique (changement d'import seulement, pas de logique).

## Primitives ui manquantes à copier depuis la source template

Aucune. Toutes les primitives nécessaires existent déjà dans `apps/web/components/ui/` : `item.tsx` (Item/ItemMedia/ItemGroup/ItemActions pour la liste de fichiers), `field.tsx` (FieldSet/FieldLegend si on veut regrouper des champs sans Card), `input-group.tsx` (pour préfixer `storage_uri`/`documentation_link` d'une icône `LinkIcon`), `alert.tsx` (pour l'encart « à valider par un humain »), `empty.tsx` (repli si aucun fichier). Le hook `use-file-upload.ts` (comportement du dropzone template) est également déjà présent dans `apps/web/hooks/`. Le composant `CountAnimation` existe dans `apps/web/components/ui/custom/count-animation.tsx`. Rien à copier depuis `shadcn-ui-kit-dashboard-main` — uniquement des motifs de composition à reproduire manuellement (le motif SVG pointillé est à écrire from scratch, aucune primitive `dropzone` n'existe ni côté source ni côté cible).
