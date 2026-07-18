# 00 — Synthèse d'orchestration (Phase 2)

Arbitrage des 14 propositions. Garantit : **une signature distincte par page**, **un langage graphique global unique**, **zéro collision de motif**, conformité stricte aux règles (tokens, monochrome, i18n, e2e).

## Politique couleur (verrouillée)
- **Thème par défaut = monochrome** (`DEFAULT_THEME.preset="default"`). `--chart-1..5` = nuances neutres (base-950/600/800/400/300 en clair, inversées en sombre). On les emploie comme **5 familles tonales**, jamais comme teintes vives.
- **Différenciation de catégorie** (domaine, section, niveau) = **nuance chart-N + motif SVG + icône + monogramme**. Jamais une couleur inventée.
- **Couleurs sémantiques** (`green/lime/amber/red` via `scoreColorClass`, `destructive`) = **réservées aux statuts réels** (score éthique par seuils, santé service, succès/échec). Interdites en décoration ou différenciation de catégorie. Les variants `Badge` `info/warning/success` (couleurs en dur) sont **proscrits** — utiliser `default`/`secondary`/`outline`/`destructive` + tokens.
- Gradients : toujours sur `var(--chart-N)`, `primary`, `muted`, `foreground` en opacités (`/5`, `/8`, `/10`, `/15`). Vérif clair **et** sombre à chaque page.

## Fondations partagées (à construire AVANT les lots produit)
1. **`apps/web/lib/datasets/domain-visuals.ts`** — source de vérité unique : `domain → { chartToken: 'chart-1'..'chart-5', icon: LucideIcon, patternId, monogram, labelKey }` pour les 9 domaines (`education, healthcare, finance, social, biology, business, environment, technology, research`). Consommé par **catalogue (05)** ET **détail (06)**. Repli gracieux (monogramme + nuance neutre) pour domaine inconnu.
2. **`apps/web/components/ibis/pattern.tsx`** — bibliothèque de **motifs SVG locaux** paramétrables (`<pattern>` : dots, grid, cross, chevron, waves, diagonal, rings, circuit, hatch), en `currentColor` + opacité, `aria-hidden`. Chaque surface pioche un motif **distinct** (voir matrice). Bornés ≤10 primitives, `id` unique par instance (pas de `<defs>` dupliqués sur 96 cartes).
3. **`apps/web/components/ibis/progress-ring.tsx`** — extraction du `ProgressRing` de `wizard-shell.tsx` (taille paramétrable), réimporté par le wizard **sans changement de rendu**. Utilisé aussi par forms/complete (07), landing (01), status (12), experiments (10).

## Matrice des signatures (anti-ressemblance)
| # | Surface | Signature (identité propre) | Texture/forme PRIMAIRE réservée | Bloc template pillé |
|---|---------|------------------------------|-------------------------------|----------------------|
| 01 | Landing | Hero « fenêtre d'app » reconstruite en vrais composants (mini rail wizard + ProgressRing + mini BarChart importance) + fil mission | **wash chart-2 + masque radial** en hero | academy/welcome-card, learning-path-card, default |
| 02 | Auth | Split-screen, panneau « sentier balisé » 9 jalons (promesse wizard) | **chemin diagonal pointillé à jalons** (vertical) | (guest) login/forgot, pages/pricing/single |
| 03 | Onboarding | Carte de calibration, cartes-choix incarnées, jauge familiarité chart-5→chart-1 | **arcs concentriques SVG** | onboarding-flow/account-type-step, settings/appearance |
| 04 | Dashboard | Cockpit personnel : hero « reprendre ma mission » + stat cards + timeline activité | **grille de points chart-2** (hero cockpit) | ecommerce/welcome, website-analytics/stat-cards, user-profile/activity-stream |
| 05 | Catalogue⭐ | Cartes tonales texturées par **domaine** (vignette gradient + motif + monogramme + score médaillon) | **bibliothèque de motifs par domaine** (possède dots/grid/cross/chevron/waves/diagonal/rings/circuit/hatch) | real-estate/property-listing-card, file-manager/folder-list-cards |
| 06 | Détail dataset | Fiche à en-tête immersif au **token du domaine** + grille tristate héroïque (10 critères) | **bandeau pleine largeur au token domaine** (filigrane) | real-estate/detail, hospital-management/progress-statistics-card |
| 07 | Formulaires⭐ | Atelier 3 temps (dépôt→radiographie→fiche), stepper horizontal (pas de rail), dropzone à motif, aperçu tabulaire réel | **dropzone pointillée + stepper à pilules horizontales** | products/create/add-product-form, settings/sidebar-nav, preview-tab |
| 08 | Scoring | Table analytique d'aide à la décision : heatmap à intensité tonale + side-panel pondérations | **heatmap monochrome (opacité primary)** | widgets (heatmap), crm/sales (side-panel réglages) |
| 09 | Projets | Espace de pilotage : cartes projet à **fil de mission** + détail à recommandations soignées | **rangée MissionStepper comme colonne vertébrale des cartes** | project-list, project-management, crm |
| 10 | Experiments+XAI | Studio analytique : **médaillon conic-gradient** de score + tuiles KPI + heatmap confusion + chat incarné | **médaillon conic-gradient** (réservé) + bulles chat | crypto/overview-card, website-analytics/stat-cards, apps/ai-chat |
| 11 | Profil | Bannière-identité (monogramme sur halo) + onglets en champs `Field` | **halo radial gradient sous monogramme** | pages/profile/profile-card, settings/account |
| 12 | Status | Cartes-services à jauge/pastille vivante + colonne timeline SSE live | **pastille pulse + timeline d'événements** | logistics/website-analytics (cartes état), ui/timeline |
| 13 | Admin | Back-office dense : tables riches, filtres, badges statut, états vides — sobre, sans gradient immersif | **densité tabulaire, zéro motif décoratif** | pages/users, ecommerce (tables), ui/empty |
| 14 | Pages d'état | Panneau tramé + monogramme filaire, numéral 404 tokenisé, toujours une sortie | **panneau tramé plein écran + numéral géant** | (guest)/pages/error/404, 403 |

**Règles anti-collision appliquées :**
- Le **motif « points »** n'est décoratif de fond que sur le **hero cockpit dashboard (04)** ; ailleurs il n'apparaît que comme un des 9 motifs de domaine du catalogue (contexte carte, jamais fond de page). Profil (11) abandonne les points au profit d'un **halo radial** ; auth (02) utilise le **chemin à jalons** (pas un champ de points) ; 404 (14) utilise un **tramé** plein écran assumé comme signature d'erreur.
- Le **médaillon conic-gradient** est **exclusif à experiments (10)**. Profil (11) et détail (06) utilisent des gradients **linéaires** (halo / bandeau domaine), pas coniques.
- Les **bandeaux gradient** varient de source : landing=chart-2 washe, détail=token **domaine** (variable), experiments=panneau primary/chart-2 autour du médaillon, profil=halo primary/chart-2 léger. Compositions distinctes.

## Politique globale (langage unique)
- **Header de page** = motif tuile-icône du wizard : `bg-primary/10 text-primary rounded-xl` (size-12) + icône lucide size-6 + `h1 text-xl/2xl font-semibold tracking-tight` + sous-titre `text-muted-foreground text-sm`. (Sur pages `(app)`, le `IbisHeader` global reste ; le header de page vit dans le contenu.)
- **Cartes** = primitive `Card` (`data-slot="card"` préservé), `rounded-xl`, hover `transition` + élévation légère quand cliquable.
- **Primitives sous-exploitées à activer** : `Field`/`Item`/`ItemGroup` (profil, forms, admin), `Timeline` (dashboard, status), `Empty` (admin, listes vides), `HoverCard` (catalogue/heatmap détail).
- Sticky + `backdrop-blur` pour barres persistantes (déjà au wizard).

## Contrats e2e — récap des points fragiles (ne jamais affaiblir)
- register : `input[type=email/password]`, bouton `auth.signUp`.
- onboarding : `onboarding.title` ; libellés `education.master`/`familiarity.4` **cliquables en tant que texte exact isolé** ; `common.next` **toujours visible** (pas de `hidden sm:inline`) ; **un seul** `input[type=number]` ; `onboarding.submit`.
- projects/new : placeholder `projects.form.namePlaceholder` ; **2 boutons libellés exactement `→`** ; `projects.form.create`.
- projects/[id] : recos = `[data-slot="card"]` + nom dataset (texte exact) + lien role=link `scoring.train`.
- experiments/[id] : `experiments.resultsTitle`, `experiments.metrics.accuracy`, onglet role=tab `experiments.tabXai`.
- xai : `xai.request.launch`, `xai.kpis.title`, `xai.charts.importance` (CardTitle intact), `xai.chat.start`, placeholder `xai.chat.placeholder`, bouton `xai.chat.send` (exact), texte `xai.chat.waiting` (conservé **en plus** de tout loader visuel). Défauts `type=global`/`method=auto` inchangés.

## Notes propositions 08/09/12/13 (reprises par l'orchestrateur, agents flaky)
- **08 scoring** : la heatmap actuelle (`score-heatmap.tsx`) code l'intensité en **`hsl()` arc-en-ciel rouge→vert en dur** (lignes 12-18) → **à remplacer** par intensité tonale monochrome (`bg-primary` à opacité = score), tout en gardant une lecture claire via le chiffre. Ajouter légende, en-têtes collants (déjà `sticky left-0`), survol détail (HoverCard). `WeightsPanel` déjà propre (sliders/switch/profils) → l'emballer en side-panel « sticky » avec total normalisé mis en valeur + micro-résumé. Toggle liste/heatmap déjà présent. Aucune donnée inventée. e2e : RAS (hors parcours). ⚠️ le `hsl` rouge→vert est le SEUL endroit qui viole la charte monochrome — c'est le gain principal du lot.
- **09 projets** : cartes projet avec `MissionStepper` en colonne vertébrale ; `/new|edit` = `ProjectForm` 3 étapes, **garder les boutons `→` exacts + placeholder** ; `/[id]` = en-tête projet + recos via `ResultsList` → **préserver `data-slot=card` + nom dataset + lien `scoring.train`**. Valoriser l'aperçu live des recommandations.
- **12 status** : page déjà fonctionnelle (health API/worker + smoke SSE). Refonte = cartes-services à **pastille d'état vivante** (`pulse-dot` keyframe existant) + jauge, et le smoke test en **timeline SSE** (`ui/timeline`) au lieu d'un `<ul>` brut. Garder le switch FR/EN et la logique EventSource. Signature = page de confiance à cartes d'état + flux live.
- **13 admin** : 4 pages tables → soigner en-têtes (compteur), barre recherche/filtres, badges statut tokenisés, **états vides** (`Empty`), actions par ligne (dropdown), pagination. Sobre, dense, **aucun gradient immersif**. Layout admin à sous-onglets déjà présent (`admin/layout.tsx`).

## Plan d'implémentation par lots (Phase 3)
0. **Fondations** : `domain-visuals.ts` + `pattern.tsx` + `progress-ring.tsx`.
1. **Datasets vitrine ⭐** : 05 catalogue + 06 détail.
2. **Datasets outils** : 07 formulaires⭐ + 08 scoring.
3. **Pilotage** : 04 dashboard + 09 projets.
4. **Résultats** : 10 experiments + XAI (+ 11 profil).
5. **Public** : 01 landing + 02 auth.
6. **Accueil & système** : 03 onboarding + 12 status.
7. **Back-office & états** : 13 admin + 14 pages d'état.

Après CHAQUE lot : `pnpm typecheck && lint && test && build` (+ `npx playwright test` si parcours touché) ; vérif navigateur clair/sombre desktop+mobile ; **commit** `style: refonte <pages> — <signature>`.
