# 05 — Catalogue datasets `/datasets`

## Signature visuelle (1 phrase forte + 3-5 mots-clés)
Un catalogue à **cartes tonales texturées** : chaque dataset porte une vignette d'en-tête gradient + motif SVG propre à son domaine (nuance `chart-1..5`, jamais de couleur inventée), avec le **score éthique en héros** — mots-clés : *vignette tonale*, *motif domaine*, *score héros*, *hover révélateur*, *grille/liste*.

## Disposition cible (wireframe ASCII)
```
┌─────────────────────────────────────────────────────────────────────────┐
│ Catalogue de datasets                          [Comparer ▤]  [+ Ajouter] │
│ Explorez, filtrez et comparez…                                          │
├─────────────────────────────────────────────────────────────────────────┤
│ [🔍 Rechercher…      ] [Filtres (3)▾] [Trier: Nom ↑▾]      [▦][≡] view  │
├─────────────────────────────────────────────────────────────────────────┤
│ [domain: healthcare ×] [ethical≥60 ×]                    Tout effacer   │
│ 24 résultats                                                             │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                │
│ │▓▓▓ vignette ▓▓▓│  │▓▓▓ vignette ▓▓▓│  │▓▓▓ vignette ▓▓▓│  grille       │
│ │ [icône] domain │  │ [icône] domain │  │ [icône] domain │  3 colonnes   │
│ │ monogr. fantôme│  │ monogr. fantôme│  │ monogr. fantôme│  (xl), 2 (sm) │
│ ├───────────────┤  ├───────────────┤  ├───────────────┤                │
│ │ Iris      [pub]│  │ Titanic  [pub]│  │ Pima     [priv]│               │
│ │ 2020 · 12 cit. │  │ 2019 · 4 cit. │  │ 2021 · 0 cit. │               │
│ │ ● Éthique 86%  │  │ ● Éthique 54% │  │ ● Éthique 71% │  ← héros       │
│ │ objectif (2l)  │  │ objectif (2l) │  │ objectif (2l) │               │
│ │ 150 lignes·4 var│ │ 891 lignes·8v │  │ 768 lignes·8v │               │
│ │ [Split][Anon]  │  │ [Split]       │  │ [Anon][Tempo] │               │
│ │ biology classif│  │ social classif│  │ healthcare reg│               │
│ ├───────────────┤  ├───────────────┤  ├───────────────┤                │
│ │ MAJ il y a 2j ⋮│  │ MAJ il y a 5j⋮│  │ MAJ il y a 1j⋮│ ← hover:      │
│ │         [Voir →]│ │        [Voir →]│ │        [Voir →]│  élévation +  │
│ └───────────────┘  └───────────────┘  └───────────────┘  action révélée │
├─────────────────────────────────────────────────────────────────────────┤
│ [12 par page ▾]                    [← Précédent]  Page 1/3  [Suivant →] │
└─────────────────────────────────────────────────────────────────────────┘
```
Vue « liste » (≡) : mêmes lignes que l'actuelle `<Table>`, mais 1ʳᵉ cellule = puce monogramme domaine (12×12, ton chart-N) devant le nom — signature cohérente sans dupliquer la vignette complète.

## Blocs template à reprendre (fichier exact → quoi en extraire)
- `shadcn-ui-kit-dashboard-main/.../real-estate/filter/components/property-listing-card.tsx` (lignes 27-45) : structure « vignette en-tête (ici `<img>`, chez nous vignette gradient+motif) + `Button icon-sm` en overlay coin haut-droit (chez nous : score éthique ou bouton favori) + `CardContent` avec titre, ligne meta icônée, **rangée de `Badge variant="outline" gap-1 font-normal"` avec icône `size-3`** (lignes 52-65) → à reprendre tel quel pour la rangée stats (instances/features/missing) et la rangée qualité (split/anonymisé/temporel).
- `shadcn-ui-kit-dashboard-main/.../real-estate/filter/components/property-listing.tsx` (lignes 419-430) : grille `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4` — déjà ce qu'utilise `datasets/page.tsx`, à conserver ; lignes 433-490 montrent le composant `Pagination`/`PaginationContent` shadcn déjà dispo dans `apps/web/components/ui/pagination.tsx` — **remplacer les boutons Précédent/Suivant actuels par ce composant** pour un rendu plus riche (chiffres de page cliquables), en gardant les libellés i18n existants sur les flèches.
- `shadcn-ui-kit-dashboard-main/.../file-manager/components/folder-list-cards.tsx` (lignes 39-70) : `Card className="hover:bg-muted transition-colors"` + `CardHeader` avec `CardTitle` icône+titre et `CardAction` (menu overflow) — pattern pour l'icône-tuile de domaine dans le header de carte et pour un futur menu contextuel (`⋮` actions rapides : comparer, entraîner) révélé au hover.
- `apps/web/components/ibis/wizard/wizard-shell.tsx` (lignes 44-64, `ProgressRing`) : réutiliser le principe d'anneau SVG en tokens (`stroke-border` / `stroke-primary`) pour une **variante compacte** = anneau de score éthique sur la carte (remplace ou complète le badge texte actuel), cohérent avec le rail du wizard. Même fichier lignes 207-219 (tuile icône `bg-primary/10 text-primary rounded-xl` + `size-6`) → transposée en `bg-[var(--chart-N)]/15 text-[var(--chart-N)]` pour la tuile-icône de domaine sur la vignette de carte.

## Composants ibis à créer / modifier (chemins)
- **Créer** `apps/web/lib/datasets/domain-visuals.ts` — module partagé (catalogue + future fiche détail) : fonction `getDomainVisual(domain: string): DomainVisual` avec `DomainVisual = { chartToken: "chart-1"|…|"chart-5"; icon: LucideIcon; pattern: DatasetPatternId; monogram: string }`. Mapping figé ci-dessous (§ Palette). Domaine inconnu (hors `KNOWN_DOMAINS`) → repli déterministe (hash simple sur la chaîne → 1 des 5 chartTokens, icône `DatabaseIcon`, motif `"dots"`, monogramme = 2 premières lettres capitalisées).
- **Créer** `apps/web/components/ibis/datasets/domain-pattern.tsx` — petit composant `<DomainPattern id={patternId} className=… />` : un seul `<svg>` par motif (9 variantes, voir § Palette), `fill="currentColor"` pour hériter `text-[var(--chart-N)]`, opacité appliquée par le parent (`/10`, `/15`). Pas de `<pattern>`/`<defs>` réutilisés inter-DOM (trop de cartes) : formes géométriques simples (≤10 primitives) répétées via un `viewBox` en mosaïque CSS (`background-repeat` non utilisable en SVG pur → dupliquer via une boucle `Array.from` légère dans le composant, borné à une grille 4×3).
- **Modifier** `apps/web/components/ibis/datasets/dataset-card.tsx` — restructurer : vignette d'en-tête (h-24) = `DomainPattern` + tuile icône domaine + monogramme fantôme en fond + badge accès (public/privé) ; sous la vignette, anneau de score éthique compact en médaillon chevauchant (`-mt-6`, `bg-background` bordé) ; conserver `Card`/`CardHeader`/`CardContent`/`CardFooter` (donc `data-slot="card"` intact) ; footer avec date de MAJ + bouton « Voir » qui devient plein-largeur au hover (translate/opacity) façon `folder-list-cards`.
- **Modifier** `apps/web/app/(app)/datasets/page.tsx` — vue table : ajouter la puce monogramme (12px, `bg-[var(--chart-N)]/15`) devant `dataset.display_name` dans la 1ʳᵉ colonne ; remplacer le bloc pagination simple (lignes 260-278) par `Pagination`/`PaginationContent`/`PaginationLink` de `components/ui/pagination.tsx` (conserver `t("pagePrev")`/`t("pageNext")` comme `aria-label`).
- **Modifier** `apps/web/components/ibis/datasets/filters-sheet.tsx` — dans la grille des facettes domaines (lignes 138-155), préfixer chaque bouton facette par l'icône lucide du domaine (`getDomainVisual(facet.value).icon`, `size-3.5`) pour ancrer le langage visuel dès le filtrage.

## Palette tonale & motifs (mapping chart-1..5 / patterns SVG, en monochrome)
Table figée dans `domain-visuals.ts` (⚠️ source de vérité unique — la future page 06 fiche détail réutilise ce même module, donc **aucune redéfinition locale du mapping ailleurs** pour éviter toute collision) :

| domain (`KNOWN_DOMAINS`) | chartToken | icône lucide | motif SVG (`patternId`) | monogramme |
|---|---|---|---|---|
| education | chart-3 | `GraduationCapIcon` | `grid` — grille fine régulière (cahier) | ED |
| healthcare | chart-1 | `HeartPulseIcon` | `cross` — croix médicales espacées | HC |
| finance | chart-2 | `LineChartIcon` | `chevrons` — chevrons ascendants | FI |
| social | chart-4 | `UsersIcon` | `dots` — nuage de points (réseau) | SO |
| biology | chart-5 | `LeafIcon` | `waves` — vagues organiques | BI |
| business | chart-3 | `BriefcaseIcon` | `diagonals` — hachures obliques régulières | BU |
| environment | chart-1 | `SproutIcon` | `rings` — anneaux concentriques | EN |
| technology | chart-2 | `CpuIcon` | `circuit` — grille + nœuds (circuit imprimé) | TE |
| research | chart-4 | `FlaskConicalIcon` | `hatch` — hachures croisées fines | RE |
| *(repli inconnu)* | hash%5 → chart-N | `DatabaseIcon` | `dots` | 2 lettres |

- Un dataset a `domain: string[]` (souvent 1 seul) : la vignette utilise `domain[0]` ; s'il y en a d'autres, ils restent listés en badges `outline` dans le corps (comme aujourd'hui).
- Application concrète sur la carte : vignette `bg-[var(--chart-N)]/10`, `DomainPattern` en `text-[var(--chart-N)]/15`, tuile icône `bg-[var(--chart-N)]/20 text-[var(--chart-N)]`, monogramme fantôme `text-[var(--chart-N)]/10 text-5xl font-black` positionné en fond droit de la vignette (`absolute -right-2 top-0 select-none`).
- Le **score éthique reste sur `scoreColorClass` existant** (`green/lime/amber/red`, `apps/web/lib/datasets/constants.ts` lignes 56-62) — c'est un statut sémantique déjà en place dans le produit (pas une couleur de domaine inventée), on ne le touche pas ; il devient juste plus proéminent visuellement (médaillon/anneau) sans changer sa logique de seuils.
- Tout reste lisible en clair **et** sombre car les opacités s'appliquent sur `var(--chart-N)` qui bascule déjà (neutre clair ↔ neutre sombre) selon `:root`/`.dark`.

## Données réelles utilisées (champs du client généré)
`DatasetCard` (`apps/web/lib/api/generated/types.gen.ts` lignes 449-534) : `display_name`, `domain[]` (→ vignette), `task[]`, `ethical_score`, `instances_number`, `features_number`, `global_missing_percentage`, `year`, `access`, `split`, `anonymization_applied`, `temporal_factors`, `objective`, `num_citations`, `representativity_level`, `updated_at` (→ footer « MAJ il y a… »). `DatasetFacets` (domaines/tâches + `count`) pour le sheet de filtres. Rien d'inventé.

## Nouvelles clés i18n (liste fr — l'implémenteur fera en)
Sous `datasets.card` (existant) — ajouts uniquement, aucune clé renommée :
- `datasets.card.updatedAgo` : "MAJ {date}" (ou réutiliser un formateur relatif déjà présent ailleurs si trouvé — sinon date brute `Intl.DateTimeFormat`, zéro clé i18n nécessaire).
- `datasets.card.quickView` : "Aperçu rapide" (libellé du bouton révélé au hover, si distinct de `card.view`).
- `datasets.domains.<key>` ×9 (education, healthcare, finance, social, biology, business, environment, technology, research) : libellé FR du domaine pour l'affichage du tag principal sous l'icône de vignette (ex. `"healthcare": "Santé"`) — **optionnel** : si non fait, on affiche `domain[0]` brut (comportement actuel déjà non traduit sur les badges, donc pas de régression si omis dans un premier temps).

Total ≈ 2 à 11 clés selon si le mapping des libellés de domaine est traduit ou non (recommandé mais non bloquant).

## Risques (e2e, parité i18n, perfs) + parades
- **e2e** : `/datasets` n'est pas sur le parcours `mission.spec.ts` (confirmé, aucun sélecteur du contrat n'y pointe). Seule contrainte : garder `DatasetCard` = `<Card>` shadcn (donc `data-slot="card"`) — respecté, on ne remplace pas par une `<div>`. **Aucun risque e2e.**
- **i18n parité** : si les clés `datasets.domains.*` sont ajoutées en `fr.json`, il faut les dupliquer en `en.json` (test vitest de parité) — sinon ne pas les créer et garder le repli « domaine brut ».
- **perfs** : jusqu'à 96 cartes/page (× `PAGE_SIZES`) avec un `<svg>` motif chacune → rester sur des motifs à ≤10 primitives géométriques (pas de flou/filtre SVG coûteux), pas de `<defs>`/`<pattern>` dupliqués par carte (le composant `DomainPattern` doit être un simple SVG statique par domaine, memoïsable). Pas de `will-change`/animation continue sur la vignette, seulement des transitions `transition-shadow`/`transition-transform` au hover (coût nul au repos).
- **Régression fonctionnelle** : le remplacement de la pagination simple par le composant `Pagination` shadcn doit conserver exactement les mêmes handlers (`catalog.setPage`) — pas de nouvelle route ni de changement de la query API.

## Primitives ui manquantes à copier depuis la source template (le cas échéant)
Aucune. Tout est déjà présent dans `apps/web/components/ui/` : `card`, `badge`, `pagination`, `hover-card`, `tooltip`, `item`, `sheet`, `select`, `slider`, `switch`, `checkbox` — la source template n'apporte que des patterns de composition (§ ci-dessus), pas de composant à porter.
