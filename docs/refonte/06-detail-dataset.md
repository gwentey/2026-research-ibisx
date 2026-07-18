# 06 — Détail dataset `/datasets/[id]`

## Signature visuelle
**Fiche produit à en-tête immersif tonal** : bandeau domaine (gradient + motif SVG + tuile monogramme/icône) surmonté de tuiles-stats façon fiche immobilière, grille tristate héroïque pour les 10 critères éthiques (le cœur pédagogique), CTA « Entraîner » proéminent. Mots-clés : *bandeau immersif · tuiles-stats · tristate héroïque · fil de mission · sobre*.

⚠️ **Dépendance externe signalée** : le bandeau consomme le module `lib/datasets/domain-visuals.ts` (icône lucide + nuance chart-1..5 par domaine) que l'agent en charge de la surface **05 — Catalogue** est censé produire/proposer. Ce module n'existe pas encore dans le repo (vérifié : aucune occurrence de `domain-visuals` dans `apps/web`). Le composant `dataset-detail-header.tsx` doit donc être écrit avec un **repli gracieux** (monogramme texte + nuance neutre `chart-1` si le module n'est pas encore livré) pour ne pas bloquer l'implémentation de cette surface.

## Disposition cible (wireframe ASCII)
```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Retour   Datasets › Iris                                          │  breadcrumb (nav)
│                                                                       │
│ ┌────┐  Iris                          [Public] [Éthique 82%]         │  bandeau gradient
│ │ 🏷 │  Classification botanique de 3 espèces à partir de mesures…   │  + motif SVG filigrane
│ └────┘  [education] [classification]                    2019 · 4 cit.│
│                                                                       │
│ ┌─────────┬─────────┬─────────┬─────────┐        [Modifier] [Entraîner→]│  tuiles-stats + CTA
│ │150 inst.│ 4 var.  │ 1 fichier│ 0% manq.│                            │
│ └─────────┴─────────┴─────────┴─────────┘                            │
├─────────────────────────────────────────────────────────────────────┤
│ Projet → ● Dataset → Entraînement → Explication        (MissionStepper)│
├─────────────────────────────────────────────────────────────────────┤
│ [📋 Vue d'ensemble] [📁 Fichiers] [🔎 Aperçu] [✨ Guide IA]           │  TabsList à icônes
├─────────────────────────────────────────────────────────────────────┤
│  ONGLET VUE D'ENSEMBLE                                                │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Conformité éthique · 6/10 critères confirmés  [███░░░░░░░]     │  │  grille tristate
│  │ ┌───────────┬───────────┬───────────┬───────────┬───────────┐ │  │  HÉROÏQUE (2 lignes
│  │ │✓ Consent. │✓ Transp.  │✕ Contrôle │? Sécurité │✓ Qualité  │ │  │  de 5 tuiles)
│  │ ├───────────┼───────────┼───────────┼───────────┼───────────┤ │  │
│  │ │✓ Anonym.  │? Conserv. │✕ Finalité │✓ Respons. │? Équité   │ │  │
│  │ └───────────┴───────────┴───────────┴───────────┴───────────┘ │  │
│  └───────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────┬──────────────────────────────────┐   │
│  │ Fiche technique          │ Métriques de qualité              │   │
│  │ Source · Disponibilité   │ Complétude ████████░░ 84%         │   │
│  │ Représentativité [badge] │ Score éthique ██████░░░░ 60%      │   │
│  │ Équilibre [badge]        │                                    │   │
│  │ ✓ Pré-divisé ✓ Anonymisé │                                    │   │
│  │ ✕ Temporel  ✓ Métadonnées│                                    │   │
│  └──────────────────────────┴──────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Datasets similaires (ItemGroup — 3 rows avec flèche →)          │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```
Onglets **Fichiers**, **Aperçu**, **Guide IA** : structure actuelle conservée (tableaux), avec habillage tuiles-stats en tête de chaque onglet (cf. blocs ci-dessous).

## Blocs template à reprendre (fichier exact → quoi en extraire)

1. **Header nav + actions** — `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/dashboard/(auth)/real-estate/detail/page.tsx` lignes 60-107 : bouton retour icône + `Breadcrumb`/`BreadcrumbList` (2 niveaux : liste → titre courant), ligne d'actions à droite en `Button variant="ghost" size="sm"`. À reprendre pour `Datasets › {display_name}` + actions (Modifier / Entraîner).
2. **Tuiles-stats du header** — même fichier, lignes 143-165 : `grid grid-cols-3 gap-3 text-sm *:space-y-1 *:rounded-md *:border *:p-3 *:text-center`, valeur `text-2xl font-semibold` + libellé icône dessous. À adapter en 4 tuiles (instances, variables, fichiers, % manquant) au lieu de 3 (beds/baths/sqft).
3. **Grille de specs label/valeur** — même fichier, lignes 46-53 (`infoItems`) et 178-185 : `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` avec `<p className="text-muted-foreground text-sm">{label}</p><p className="font-medium">{value}</p>`. À reprendre telle quelle pour la nouvelle « Fiche technique » (source, disponibilité, représentativité, équilibre).
4. **Rangée 3-stats compacte** — `.../real-estate/detail/components/market-value-section.tsx` lignes 66-85 : trois `Card><CardContent className="space-y-2 px-4">` avec libellé + valeur `text-3xl font-semibold`. Alternative pour la tête de l'onglet Aperçu (lignes totales / colonnes affichées / graine d'échantillonnage) à la place du paragraphe actuel.
5. **Ligne « statut » à tuile icône** — `.../hospital-management/components/progress-statistics-card.tsx` lignes 27-46 : `flex items-center justify-between rounded-md border p-4` + tuile icône `flex size-10 items-center justify-center rounded-lg` à gauche, `Badge` de statut à droite. **Pattern central de la grille tristate éthique** : reprendre la structure (tuile + libellé + badge d'état) mais **recolorer en tokens neutres/sémantiques déjà en usage dans le code** (`text-green-600 dark:text-green-400` / `text-red-600 dark:text-red-400` / `text-muted-foreground` — convention déjà présente dans `overview-tab.tsx` `TristateIcon` et `constants.ts` `scoreColorClass`, donc pas une couleur inventée) — jamais les teintes vives indigo/purple/orange du template source.
6. **Icône flottante en médaillon** — `.../hospital-management/components/summary-cards.tsx` lignes 11-15 : `div.absolute end-4 top-0 flex size-12 items-center justify-center rounded-full` en coin de carte. Idée à retenir pour la tuile-domaine du bandeau (médaillon `bg-primary/10 text-primary rounded-2xl`), **jamais** avec les couleurs `bg-indigo-200`/`bg-green-200` du template (remplacer par `bg-primary/10`).
7. **Liste patients (Avatar + meta + valeur alignée)** — `.../hospital-management/components/patients-with-last-procedure.tsx` lignes 62-84 : structure `flex` avec `Avatar`/`AvatarFallback` (initiales) à gauche, bloc `ml-auto text-end`. Inspire le remplacement des `similar` datasets (actuellement des `<Link>` bruts en `overview-tab.tsx`) par des `Item`/`ItemMedia`/`ItemContent`/`ItemActions` du kit (`apps/web/components/ui/item.tsx`, déjà présent) — respecte la consigne mémoire « jamais de primitives nues ».

## Composants ibis à créer / modifier (chemins)
- **Nouveau** `apps/web/components/ibis/datasets/dataset-detail-header.tsx` — extrait le bandeau (nav, identité, tuiles-stats, actions) hors de `page.tsx`. Props : `dataset: DatasetDetail`, `canEdit: boolean`. Consomme `domain-visuals.ts` (repli monogramme si absent).
- **Nouveau** `apps/web/components/ibis/datasets/ethical-criteria-grid.tsx` — extrait la grille tristate hors de `overview-tab.tsx`, avec un résumé chiffré en tête (« X/10 critères confirmés ») et une mini-barre segmentée (confirmés/absents/inconnus) en tokens neutres.
- **Modifier** `apps/web/app/(app)/datasets/[id]/page.tsx` — retirer le bloc header inline (lignes 77-113) au profit de `DatasetDetailHeader` ; insérer `<MissionStepper current="dataset" />` sous le header ; `TabsTrigger` avec icône lucide (`ClipboardListIcon`, `FolderIcon`, `TableIcon`, `SparklesIcon`) devant chaque libellé `td(...)` (texte inchangé, donc aucun risque e2e).
- **Modifier** `apps/web/components/ibis/datasets/overview-tab.tsx` — repositionner `EthicalCriteriaGrid` en premier bloc (pleine largeur, avant les 2 cartes) ; enrichir la carte « Informations générales » → « Fiche technique » avec `representativity_level`, `sample_balance_level` (badges) et les 4 indicateurs booléens (`split`, `anonymization_applied`, `temporal_factors`, `metadata_provided_with_dataset`) rendus en mini-lignes tuile+badge (bloc 5 ci-dessus) ; remplacer les `<Link>` de la section « similaires » par `ItemGroup`/`Item`.
- **Modifier** `apps/web/components/ibis/datasets/preview-tab.tsx` — remplacer le paragraphe de stats (lignes 52-62) par 3 tuiles (bloc 4 ci-dessus : lignes totales, colonnes affichées/totales, graine si échantillonné) ; badge `outline` autour de `dtype_interpreted` dans l'en-tête de colonne (aligne le vocabulaire visuel avec `files-tab.tsx` qui utilise déjà un `Badge` pour le type).
- **Modifier** `apps/web/components/ibis/datasets/files-tab.tsx` — remplacer l'icône `FileIcon` nue du `CardTitle` par une tuile `bg-primary/10 rounded-lg p-1.5` (cohérence avec le médaillon du header) ; sinon structure de table inchangée (peu de fichiers par dataset seedé → pas besoin du sélecteur maître-détail de la v1).
- **Modifier** `apps/web/components/ibis/datasets/guide-tab.tsx` — envelopper la barre d'actions (bouton générer + badges modèle) dans une tuile icône `SparklesIcon` façon en-tête de carte, pour aligner avec le niveau du reste de la page ; logique SSE strictement inchangée.
- **Dépendance externe** `apps/web/lib/datasets/domain-visuals.ts` — **pas créé par cette surface** ; à consommer depuis le header et, idéalement, depuis `dataset-card.tsx` (catalogue) pour la cohérence visuelle carte ↔ fiche.

## Palette tonale & motifs (mapping chart-1..5 / patterns SVG, en monochrome)
- **Bandeau** : `bg-gradient-to-br from-primary/[0.06] via-card to-chart-2/[0.05]` + motif SVG local en filigrane (grille de points ou lignes topographiques, `opacity-[0.035] text-foreground`, `absolute inset-0 pointer-events-none`), `overflow-hidden rounded-xl border`.
- **Tuile domaine (médaillon)** : `size-14 rounded-2xl bg-primary/10 text-primary` + icône lucide du domaine (via `domain-visuals`) ou, en repli, monogramme (2 premières lettres de `display_name`) en `font-display text-lg`.
- **Tuiles-stats du header** : `rounded-md border` neutre (pas de fond coloré), valeur en `text-foreground`, libellé en `text-muted-foreground` — différencie du médaillon domaine qui porte, lui, la nuance.
- **Grille tristate éthique** : icône + tuile `size-10 rounded-lg` — `true` → `bg-foreground/5 text-green-600 dark:text-green-400` (convention existante `TristateIcon`), `false` → `text-red-600 dark:text-red-400`, `null` → `bg-muted text-muted-foreground`. Pas de nouvelle couleur : reprise strico sensu de `scoreColorClass`/`TristateIcon` déjà en place.
- **Mini-barre segmentée du résumé éthique** : 3 segments (`bg-green-600/70`, `bg-red-600/70`, `bg-muted`) proportionnels au décompte — seul endroit de la page où une couleur sémantique (pas domaine) est utilisée, cohérent avec l'existant.
- **Signature vs carte catalogue** : la carte du catalogue (05) résume avec un motif compact en coin + nuance ; **ici** le motif est **pleine largeur en bandeau** et le médaillon est **plus grand avec icône réelle** (pas juste un point de couleur) — même langage, densité différente (« on résume » vs « on déploie »), comme demandé par le brief.

## Données réelles utilisées (champs du client généré)
- **Déjà affichés (conservés)** : `display_name`, `access`, `ethical_score`, `year`, `instances_number`, `features_number`, `global_missing_percentage`, `domain[]`, `task[]`, `objective`, `sources`, `availability`, `storage_uri`, `documentation_link`, `citation_link`, `completeness`, `ethical_criteria` (10 clés `ETHICAL_KEYS`), `files[]` (via `FilesTab`), `ai_guide`.
- **Nouveaux, exposés par `DatasetDetail` mais pas encore affichés** : `num_citations` (tuile header « X citations »), `representativity_level` + `representativity_description` (badge + tooltip/texte), `sample_balance_level` + `sample_balance_description`, `split`, `anonymization_applied`, `temporal_factors`, `metadata_provided_with_dataset` (4 indicateurs booléens — déjà utilisés en `Badge` sur `dataset-card.tsx` pour 3 d'entre eux, donc cohérence à réutiliser), `features_description` (à afficher si présent, sous la fiche technique), `missing_values_description` / `missing_values_handling_method` (à afficher si `has_missing_values`), `created_at`/`updated_at` (footer discret « Ajouté le… / Mis à jour le… »).
- **Similaires** : `SimilarDataset[]` (`dataset: DatasetCard`, `reason`) — inchangé, juste re-composé en `Item`.
- **Fichiers/colonnes** : `FileWithColumns` (`original_filename`, `logical_role`, `size_bytes`, `row_count`, `columns: ColumnRead[]`), `ColumnRead` (`dtype_interpreted`, `is_pii`, `is_nullable`, `example_values`, `stats`, `position`).
- **Aperçu** : `DatasetPreview` (`rows`, `column_stats`, `sampled`, `random_state`, `total_rows`, `total_columns`, `displayed_columns`).
- **CTA « Entraîner »** : aucune nouvelle donnée — lien statique `Link href="/projects/new"` (le choix du dataset se fait plus loin dans le parcours via le scoring de recommandations, cf. contrat e2e ; on ne préremplit rien, on ouvre juste la mission).

## Nouvelles clés i18n (liste fr — l'implémenteur fera en)
Sous `datasets.detail.*` (sauf mention contraire) :
- `technicalSheet`: "Fiche technique" *(renomme/complète l'actuel `generalInfo`, à garder ou fusionner)*
- `representativity`: "Représentativité"
- `sampleBalance`: "Équilibre de l'échantillon"
- `indicatorSplit`: "Jeu pré-divisé (train / test)"
- `indicatorAnonymized`: "Anonymisation appliquée"
- `indicatorTemporal`: "Facteurs temporels"
- `indicatorMetadata`: "Métadonnées fournies"
- `ethicsSummary`: "{confirmed} critère(s) confirmé(s) sur 10"
- `ethicsAbsentCount`: "{count} absent(s)"
- `ethicsUnknownCount`: "{count} non évalué(s)"
- `previewRowsLabel`: "lignes totales"
- `previewColumnsLabel`: "colonnes affichées"
- `previewSeedLabel`: "graine d'échantillonnage"
- `missingHandling`: "Traitement des valeurs manquantes"
- `addedOn`: "Ajouté le {date}"
- `updatedOn`: "Mis à jour le {date}"

**Réutilisation notable (aucune clé à créer)** : `datasets.detail.useInProject` (« Utiliser dans un projet ») et `datasets.detail.download` existent déjà dans `fr.json`/`en.json` mais **ne sont câblés nulle part actuellement** (vérifié par grep) — `useInProject` est le libellé naturel du CTA proéminent vers `/projects/new` demandé par le brief, `download` peut habiller un bouton secondaire dans le header (premier fichier `data_file`, réutilise la logique de téléchargement déjà présente dans `files-tab.tsx`).

## Risques (e2e, parité i18n, perfs) + parades
- **e2e** : `/datasets/[id]` n'apparaît dans aucun sélecteur du contrat `mission.spec.ts` (§"Contrats e2e" de `_SHARED.md`) — risque faible. Parade : conserver les `TabsTrigger` avec le **même texte** `td("tabOverview"|"tabFiles"|"tabPreview"|"tabGuide")` (ajouter une icône devant ne casse pas un sélecteur texte/role), conserver le bouton `Modifier` (`td("edit")`) et son `href` vers `/datasets/${id}/complete` à l'identique.
- **i18n parité** : 15 nouvelles clés `datasets.detail.*` → à ajouter dans `fr.json` **et** `en.json` (test vitest de parité) ; réutiliser `useInProject`/`download` évite d'en ajouter deux de plus.
- **Dépendance `domain-visuals.ts` non livrée** : si la surface 05 livre le module après cette surface, le header doit fonctionner en repli (monogramme + `chart-1` neutre) sans erreur d'import cassée — écrire le header pour importer le module en optionnel/best-effort, ou coordonner l'ordre d'implémentation avec l'agent 05.
- **Perf** : aucune nouvelle requête réseau (tous les champs supplémentaires sont déjà dans la réponse `getDataset` existante) ; le seul ajout dynamique est le SSE du guide IA, inchangé.
- **Régression fonctionnelle** : le téléchargement de fichier (`downloadDatasetFile` → blob → anchor) et le flux SSE du guide (`EventSource` sur `/api/v1/jobs/{id}/events`) doivent être déplacés tels quels si le code est extrait dans de nouveaux composants — aucune modification de logique, seulement de disposition.

## Primitives ui manquantes à copier depuis la source template
Aucune. `Item`/`ItemGroup`/`ItemMedia`/`ItemContent`/`ItemActions` (`apps/web/components/ui/item.tsx`), `HoverCard`, `Empty`, `Badge`, `Progress`, `Breadcrumb`, `Separator`, `CountAnimation` (`apps/web/components/ui/custom/count-animation.tsx`) sont **déjà présents** dans `apps/web/components/ui/*` — pas de copie depuis `shadcn-ui-kit-dashboard-main` nécessaire pour cette surface.
