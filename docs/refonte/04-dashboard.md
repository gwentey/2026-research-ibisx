# 04 — Dashboard `/dashboard`

## Signature visuelle
**Un cockpit personnel vivant qui pousse à l'action, pas un tableau d'analyse.** Mots-clés : *reprise de mission*, *carte hero mission*, *timeline d'activité*, *tonal chart-2/points*, *listes `Item` denses*. Se distingue radicalement de `/experiments/[id]` (résultats/analytique, dense en graphes) : ici la densité sert la décision "que fais-je maintenant ?", pas la lecture de métriques de modèle.

## Disposition cible (wireframe ASCII)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Bonjour {name} 👋                                                        │  h1 existant (welcome/welcomeFallback)
├──────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────┐          │
│ │ CARTE HERO — Mission en cours (col-span large, motif points)│          │
│ │  MissionStepper current="training"                          │          │
│ │  "Reprendre : {dataset}"          [Continuer →] (Link wizard)│          │
│ │  — si pending_draft null : état vide "Aucune mission en     │          │
│ │    cours" + CTA "Nouveau projet" (mission project)          │          │
│ └────────────────────────────────────────────────────────────┘          │
├──────────────────────────────────────────────────────────────────────────┤
│ [Stat FlaskConical]  [Stat Folder]  [Stat TrendingUp/Down]  [Stat Timer] │  4 stat cards (grid sm:2 xl:4)
│  Expériences totales  Projets actifs  Taux de succès         Durée moy. │
├───────────────────────────────────────────┬──────────────────────────────┤
│ ACTIVITÉ RÉCENTE (Card lg:col-span-2)      │ ACTIONS RAPIDES (Card)      │
│  Timeline verticale (ui/timeline)          │  + Nouveau projet            │
│   ● [icône kind] Titre — Badge statut      │  ⌕ Explorer les datasets     │
│     TimelineDate · bouton "Voir"           │                              │
│   ● ...                                    ├──────────────────────────────┤
│  (Empty si vide)                           │ PROJETS RÉCENTS (Card)       │
│  CardFooter → "Voir toutes les expériences"│  ItemGroup (Folder + nom +   │
│                                             │  date maj + bouton Ouvrir)   │
│                                             │  (Empty si vide)             │
│                                             │  CardFooter → "Voir tous"    │
└───────────────────────────────────────────┴──────────────────────────────┘
```

Ordre de lecture volontaire : **salutation → où j'en suis (hero mission) → mes chiffres (KPI) → ce qui vient de se passer (activité) → ce que je peux faire ensuite (actions/projets)**. C'est l'inverse d'un dashboard analytique (qui mettrait les graphes en premier) : ici le premier bloc dense est actionnable, pas informatif.

## Blocs template à reprendre (fichier exact → quoi en extraire)

- `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/dashboard/(auth)/ecommerce/components/welcome.tsx` (lignes 4-31) — structure de la **carte hero** : `Card className="bg-muted relative overflow-hidden"`, `CardHeader` (titre+description), `CardContent` en `flex items-center justify-between` (info à gauche / bouton à droite), image de fond `absolute inset-0`. **Adapter** : remplacer `star-shape.png` par un motif SVG local en `--chart-2` (pas d'image), remplacer le titre/CTA par `MissionStepper` + libellé de reprise, remplacer le bouton par un `Link` vers `/wizard?projectId=…&datasetId=…`.
- `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/dashboard/(auth)/website-analytics/components/stat-cards.tsx` (lignes 35-71) — structure de **stat card** : ligne du haut `dt` (label) + `Badge` tendance à droite, puis `dd` valeur en `text-3xl font-semibold` en dessous. Reprendre cette hiérarchie (label+signal au-dessus, grosse valeur en dessous) à la place de l'actuel `flex items-center gap-3` (icône+texte côte à côte) du fichier v2 actuel — plus proche du niveau du wizard.
- `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/dashboard/(auth)/ecommerce/components/stat-cards.tsx` (lignes 33-66) — variante avec icône de tuile en amont (`CardFooter` "View more") : s'en inspirer seulement pour le **`CardFooter` lien "voir plus"** réutilisé sur les cartes Activité récente / Projets récents (pas pour les stat cards elles-mêmes).
- `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/dashboard/(auth)/pages/user-profile/components/activity-stream.tsx` (lignes 74-158) — **pattern timeline complet** : `Card` → `CardHeader`/`CardTitle` → `CardContent` avec `Timeline defaultValue={n}` contenant `TimelineItem` → `TimelineHeader` (`TimelineSeparator` + `TimelineTitle` + `TimelineIndicator`) → `TimelineContent` (badge/texte + `TimelineDate`) → `CardFooter` avec bouton "View more". C'est le bloc à copier presque tel quel pour `recent_activity`, en remplaçant fichiers/images par le badge de statut + bouton "Voir".
- `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/dashboard/(auth)/ecommerce/components/recent-orders.tsx` (lignes 304-324) — **pattern de mapping statut → badge** ; à *ne pas* copier tel quel (le template utilise des variantes colorées `success/info/warning/destructive`) mais confirme la logique déjà en place dans `apps/web/app/(app)/dashboard/page.tsx` lignes 26-32 (`STATUS_VARIANT`) qui reste monochrome (`default/secondary/outline/destructive`) — **à conserver strictement telle quelle**, ne pas migrer vers les variantes colorées du kit.
- `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/dashboard/(auth)/default/page.tsx` (lignes 25-53) — référence de **layout global** : `h1` + actions à droite, puis grille `lg:grid-cols-3` avec cartes en `col-span`. Confirme la disposition 2/3 + 1/3 déjà choisie ci-dessus.

## Composants ibis à créer / modifier (chemins)

- **Modifier** `apps/web/app/(app)/dashboard/page.tsx` (271 lignes actuelles) : réorganiser en 4 sections (hero mission, KPI, activité, colonne latérale), déplacer `MissionStepper` (déjà importé nulle part ici — nouveauté) dans le hero.
- **Créer** `apps/web/components/ibis/dashboard/mission-hero-card.tsx` — la carte hero : reçoit `pendingDraft: WizardDraftPointer | null`. Si présent → motif points + `MissionStepper current="training"` + titre + `Link` vers le wizard (réutilise `t("quickActions.resumeWizard")` comme libellé bouton, `t("quickActions.resumeHint", {dataset})` comme sous-titre). Si absent → variante `Empty`/`EmptyMedia variant="icon"` avec `FolderIcon`, invite à créer un projet (`Link` vers `/projects/new`, réutilise `quickActions.newProject`).
- **Créer** `apps/web/components/ibis/dashboard/stat-tile.tsx` — stat card réutilisable (icône dans tuile tonale `bg-chart-N/10 text-chart-N`, label, valeur `text-3xl font-semibold`, signal optionnel `trend?: "up" | "down" | null`). Remplace le mapping `kpiTiles` inline actuel (lignes 62-87 du fichier existant).
- **Créer** `apps/web/components/ibis/dashboard/recent-activity-timeline.tsx` — encapsule `Timeline`/`TimelineItem`/… (`apps/web/components/ui/timeline.tsx`, déjà présent) pour `data.recent_activity`.
- **Créer** `apps/web/components/ibis/dashboard/recent-projects-list.tsx` — utilise `Item`/`ItemGroup`/`ItemMedia`/`ItemContent`/`ItemTitle`/`ItemDescription`/`ItemActions` (`apps/web/components/ui/item.tsx`, déjà présent, pas encore utilisé côté dashboard) pour `data.recent_projects`, à la place des `<div className="flex items-center gap-2 text-sm">` actuels (lignes 199-207).
- **Réutiliser tel quel** `apps/web/components/ibis/mission-stepper.tsx` (aucune modification requise) et `apps/web/components/ui/empty.tsx` pour les 3 états vides (hero, activité, projets récents).

## Palette tonale & motifs (mapping chart-1..5 / patterns SVG, en monochrome)

- **Carte hero mission** : fond `bg-muted/40`, motif SVG **grille de points** (cercles `r=1` espacés régulièrement, `fill="var(--chart-2)"`, `opacity: .12` clair / `.18` sombre) plaqué en `absolute inset-0 pointer-events-none`, dégradé de masquage `mask-image: linear-gradient(to right, black, transparent)` pour fondu vers la droite. Tuile d'icône `bg-primary/10 text-primary rounded-xl` (même langage que le header du wizard).
- **Stat tiles** (4) : chacune une nuance distincte pour la tuile icône, en restant sur l'échelle neutre déjà définie dans `apps/web/app/globals.css` (lignes 41-45 clair / 90-94 sombre) : Expériences → `bg-chart-1/10 text-chart-1`, Projets actifs → `bg-chart-2/10 text-chart-2`, Taux de succès → `bg-chart-3/10 text-chart-3`, Durée moyenne → `bg-chart-4/10 text-chart-4`. Icônes lucide déjà choisies dans le code actuel (`FlaskConicalIcon`, `FolderIcon`, `TrendingUpIcon`, `TimerIcon`).
- **Timeline activité** : `TimelineIndicator` coloré `border-primary/30` si `kind==="experiment"`, `border-chart-3/40` si `kind==="explanation"` (léger différenciateur tonal, cohérent avec l'icône `LightbulbIcon` déjà utilisée).
- Aucun hex, aucune couleur vive : tout passe par `var(--chart-N)`, `primary`, `muted`, `foreground` + opacités. Le badge `destructive` reste la seule couleur "chaude" (déjà token système, déjà utilisé pour `failed`).

## Données réelles utilisées (champs du client généré)

Toutes issues de `GET /dashboard` → `DashboardResponse` (`apps/web/lib/api/generated/types.gen.ts` lignes 429-442) :
- `kpis.total_experiments`, `kpis.active_projects`, `kpis.success_rate` (nullable), `kpis.average_duration_seconds` (nullable) — type `DashboardKpis` lignes 409-426.
- `pending_draft: WizardDraftPointer | null` (lignes 2486-2507) : `dataset_id`, `dataset_name`, `experiment_id`, `project_id`, `updated_at` → alimente la carte hero et le lien `/wizard?projectId=…&datasetId=…`.
- `recent_activity: ActivityItem[]` (lignes 20-45) : `kind` (`experiment`|`explanation`), `label`, `status`, `created_at`, `experiment_id`, `ref_id` → timeline.
- `recent_projects: RecentProject[]` (lignes 2110-2123) : `id`, `name`, `updated_at` → liste `Item`.
- `user.credits` (déjà affiché dans `IbisHeader`, `apps/web/components/ibis/layout/ibis-header.tsx` lignes 30-35) : **ne pas dupliquer** sur le dashboard, il est déjà visible en permanence dans le header applicatif — évite la redondance signalée par le brief sans ajouter de bloc crédits superflu.

**Aucune donnée inventée** : pas de delta temporel (`+X%`) car le backend ne fournit aucun historique — seul un signal qualitatif dérivé de `success_rate` (seuil ≥ 50 % → icône `TrendingUpIcon` ton `chart-3`, sinon `TrendingDownIcon` `text-muted-foreground`) est ajouté, car il n'affiche pas un nombre fictif, seulement une lecture de la vraie valeur déjà présente.

## Nouvelles clés i18n (liste fr — l'implémenteur fera en)

Sous `dashboardHome` (fr) — ~10 nouvelles clés, le reste existe déjà :
```
"hero": {
  "title": "Votre mission",
  "emptyTitle": "Aucune mission en cours",
  "emptyBody": "Créez un projet pour lancer votre première expérience."
},
"activity": {
  "emptyTitle": "Aucune activité pour l'instant",
  "viewAll": "Voir toutes les expériences"
},
"recentProjects": {
  "emptyTitle": "Aucun projet pour l'instant",
  "viewAll": "Voir tous les projets"
},
"kpis": {
  "successGood": "Bon niveau",
  "successLow": "À surveiller"
}
```
Les clés `quickActions.resumeWizard` et `quickActions.resumeHint` existent déjà (non utilisées actuellement dans le code — `quickActions.resumeHint` sert déjà de sous-titre du bouton lignes 181-184, `resumeWizard` est présente dans `fr.json` ligne 144 mais jamais lue : à réemployer comme libellé du CTA hero). `activity.empty` et `recentProjects.empty` existants deviennent le corps (`EmptyDescription`) sous les nouveaux titres (`EmptyTitle`).

## Risques (e2e, parité i18n, perfs) + parades

- **e2e** : `apps/web/e2e/mission.spec.ts` ligne 60 attend seulement `page.waitForURL("**/dashboard")` après l'onboarding — aucun sélecteur précis sur cette page. **Risque nul** tant que l'URL et le rendu (pas d'erreur JS) restent stables. Vérifier que le hero ne bloque pas le rendu si `pending_draft` est `null` juste après onboarding (cas garanti à ce stade du test).
- **Parité i18n** : le test vitest de parité FR/EN impose d'ajouter chaque nouvelle clé dans `messages/en.json` en miroir — à ne pas oublier (`hero.*`, `activity.emptyTitle`, `activity.viewAll`, `recentProjects.emptyTitle`, `recentProjects.viewAll`, `kpis.successGood`, `kpis.successLow`).
- **Perfs** : aucun nouvel appel réseau (toujours un seul `getDashboard()`), le motif SVG est inline (pas d'asset externe) — impact négligeable.
- **Régression fonctionnelle** : le lien du hero vers le wizard doit garder exactement l'URL actuelle `/wizard?projectId=${pending_draft.project_id}&datasetId=${pending_draft.dataset_id}` (page actuelle lignes 177-178) — ne pas la modifier en extrayant le composant.

## Primitives ui manquantes à copier depuis la source template (le cas échéant)

Aucune. `Timeline` (`apps/web/components/ui/timeline.tsx`) et `Item`/`Empty` (`apps/web/components/ui/item.tsx`, `apps/web/components/ui/empty.tsx`) sont déjà présents dans `apps/web` et identiques à la source — rien à copier.
