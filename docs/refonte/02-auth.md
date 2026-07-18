# 02 — Auth (`/login`, `/register`, `/forgot-password`, `/reset-password`)

## Signature visuelle (1 phrase forte + mots-clés)
Un **panneau de marque « sentier balisé »** : fond tonal (gradient `primary`/`chart-2` en très faible opacité) traversé par un chemin en pointillés reliant 9 jalons — la promesse du parcours guidé, montrée avant même d'y entrer.
Mots-clés : **seuil**, **sentier**, **tonal**, **aéré**, **confiance**.

Ce panneau remplace la photo stock générique du template (`/images/extra/image4.jpg`) actuellement utilisée telle quelle dans `guest-shell.tsx` — c'est la seule surface du parcours qui montrait encore une image non liée au produit.

## Disposition cible (wireframe ASCII)

Desktop (≥ lg), inchangé dans sa structure (split 50/50, comme aujourd'hui) mais le panneau gauche devient du contenu de marque au lieu d'une image :

```
┌───────────────────────────────┬─────────────────────────────────────┐
│ PANNEAU DE MARQUE (w-1/2)      │ FORMULAIRE (w-1/2, centré, max-w-md) │
│ bg-muted/30 + gradient tonal   │                                       │
│                                 │                                       │
│  [Logo] IBIS-X                 │        (titre + sous-titre centrés)   │
│                                 │        Bon retour                     │
│   ┄●┄┄┄●┄┄┄◉┄┄┄●┄┄┄●┄┄┄●┄┄┄●┄●  │        Connectez-vous à votre compte  │
│   (sentier pointillé, 9 jalons,│                                       │
│    jalon 3 plein = "vous       │  ┌─────────────────────────────────┐ │
│    êtes ici, avant le voyage") │  │  Google (icône + libellé)       │ │
│                                 │  └─────────────────────────────────┘ │
│  "Former un modèle,            │        ───────  ou  ───────           │
│   comprendre chaque choix."    │                                       │
│  (tagline, text-2xl semibold)  │  ┌ InputGroup ─────────────────────┐ │
│                                 │  │ ✉  Adresse email                │ │
│  ✓ tile 6 jeux de données      │  └──────────────────────────────────┘ │
│  ✓ tile 10 critères éthiques   │  ┌ InputGroup ─────────────────────┐ │
│  ✓ tile 9 étapes guidées       │  │ 🔒  Mot de passe            👁  │ │
│                                 │  └──────────────────────────────────┘ │
│                                 │                    Mot de passe oublié?│
│  (footer, bas de panneau)      │                                       │
│  Issu d'un projet de recherche │  [       Se connecter       ]         │
│  — M2 MIAGE, Paris 1           │                                       │
│                                 │  Pas de compte ? Créer un compte      │
└───────────────────────────────┴─────────────────────────────────────┘
```

Mobile (< lg) : le panneau plein ne s'affiche pas (coût vertical trop grand). On le remplace par une **bande de marque compacte** (~96–112px), pas un `hidden` total comme aujourd'hui :

```
┌─────────────────────────────────────┐
│ bande gradient tonale, motif rogné   │
│ [Logo] IBIS-X · "9 étapes guidées"   │
├─────────────────────────────────────┤
│         (formulaire, pleine largeur) │
└─────────────────────────────────────┘
```

Les 4 pages (login/register/forgot/reset) partagent strictement ce panneau via `GuestShell` — un seul point de vérité pour la marque, zéro duplication de contenu entre les 4 écrans.

## Blocs template à reprendre (fichier exact → quoi en extraire)
- `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/dashboard/(guest)/login/v1/page.tsx` (lignes 20-31) : structure split `flex` / `hidden w-1/2 ... lg:block` / `w-1/2 flex items-center justify-center` — c'est déjà la base de `guest-shell.tsx` actuel ; on ne change QUE le contenu de la colonne gauche (image → `AuthBrandPanel`), la mécanique de layout reste identique (zéro risque de régression de structure).
- `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/dashboard/(guest)/forgot-password/page.tsx` (lignes 66-80) : pattern icône dans le champ (`MailIcon` en `absolute left-3`). On modernise ce pattern avec le composant `InputGroup`/`InputGroupAddon`/`InputGroupInput` déjà présent dans `apps/web/components/ui/input-group.tsx` (équivalent propre, gère déjà le focus-ring et l'état `aria-invalid`) plutôt que du positionnement absolu manuel.
- `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/dashboard/(auth)/pages/pricing/single/page.tsx` (ligne ~111, `<Check className="mr-2 size-5 shrink-0 text-green-600" />` dans une liste d'avantages) : reprendre l'idée de **liste de preuves à puce iconée**, mais recolorée en tokens (`bg-primary/10 text-primary` au lieu de `text-green-600`) — c'est exactement le pattern tuile-icône du wizard (`apps/web/components/ibis/wizard/wizard-shell.tsx` ligne 208 : `bg-primary/10 text-primary rounded-xl`), réutilisé en plus petit (`size-9 rounded-lg`) pour les 3 preuves du panneau.
- `apps/web/components/ibis/wizard/wizard-shell.tsx` (fonction `ProgressRing`, lignes 45-64) : principe de cercle SVG en `stroke-primary`/`stroke-border` — repris en très grand format et très faible opacité (`stroke-foreground/10`, non animé) comme motif décoratif de fond, jamais comme élément fonctionnel (à ne pas confondre avec l'anneau réel du wizard).

## Composants ibis à créer / modifier (chemins)
- **Créer** `apps/web/components/ibis/auth-brand-panel.tsx` — exporte `AuthBrandPanel`. Contient :
  - le fond tonal (`absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-chart-2/[0.12]` sur un conteneur `bg-muted/30 dark:bg-muted/20`) ;
  - le motif SVG « sentier » (voir section palette ci-dessous), `aria-hidden="true"`, en `absolute` derrière le contenu ;
  - le contenu au premier plan (`relative z-10`) : `Logo` (réutilise `@/components/layout/logo`) + nom d'app, tagline, sous-titre, 3 tuiles de preuves (icône + libellé), footer avec la note recherche ;
  - deux rendus internes pilotés par classes responsive : `hidden lg:flex` (panneau plein, colonne) et `flex lg:hidden` (bande compacte, ligne) — un seul composant, un seul contenu source, pas de duplication de copy.
- **Modifier** `apps/web/components/ibis/guest-shell.tsx` : remplacer le bloc `<Image .../>` (lignes 9-18) par `<AuthBrandPanel />`. La mécanique `flex`/`w-1/2`/`lg:h-screen` ne change pas.
- **Modifier** `apps/web/app/(guest)/login/page.tsx`, `register/page.tsx` : remplacer les paires `Label sr-only` + `Input` (email, password) par `InputGroup` + `InputGroupAddon` (icône `MailIcon`/`LockIcon`, `align="inline-start"`) + `InputGroupInput`. Garder `Label` en `sr-only` tel quel pour l'accessibilité (aucun changement de `htmlFor`/`id`). **Ne pas changer** `type="email"` / `type="password"`, `autoComplete`, `{...form.register(...)}`, `aria-invalid`.
- **Modifier** `apps/web/app/(guest)/forgot-password/page.tsx`, `reset-password/page.tsx` : même traitement (icône `MailIcon` / `LockIcon` en `InputGroup`).
- **Optionnel (micro-détail, non bloquant)** : bouton œil pour afficher/masquer le mot de passe via `InputGroupButton` en `align="inline-end"` (icône `EyeIcon`/`EyeOffIcon` togglées en state local). Le `type` de l'input reste `"password"` au montage — le toggle ne change `type` qu'après interaction utilisateur, donc aucun risque pour le contrat e2e qui lit l'état initial.
- **Ne pas toucher** `apps/web/components/ibis/google-button.tsx` (logique intacte) — polish visuel mineur possible : aligner sa hauteur (`h-9`) sur celle des nouveaux `InputGroup` pour une grille cohérente.

## Palette tonale & motifs (mapping chart-1..5 / patterns SVG, en monochrome)
- Fond du panneau : `bg-muted/30` (clair) / `bg-muted/20` (sombre) + wash `bg-gradient-to-br from-primary/[0.06] via-transparent to-chart-2/[0.12]`. Jamais de `bg-primary` plein (s'inverserait en bloc quasi-blanc en dark mode puisque `--primary` devient `--base-50` — cf. `app/globals.css` lignes 78/90).
- Motif « sentier » : `<svg>` en `absolute inset-0` avec un `<path>` en pointillés (`stroke-foreground/10`, `stroke-dasharray`) traversant le panneau en diagonale, ponctué de 9 `<circle>` (jalons) : 8 en `fill-none stroke-primary/25`, 1 (3ᵉ jalon, « vous êtes ici », avant le grand voyage) en `fill-primary` plein. Complété par 2 grands cercles concentriques très estompés (`stroke-primary/10`, rayon ~180-260px, non animés) en coin bas-droit, dans l'esprit du `ProgressRing` du wizard mais purement décoratif et hors-champ (jamais de couleur vive, jamais d'icône dedans).
- Tuiles de preuves : `size-9 rounded-lg bg-primary/10 text-primary` + icône lucide `size-4` (reprend exactement le pattern tuile-icône du wizard, à plus petite échelle).
- Icônes des 3 preuves : `DatabaseIcon` (6 jeux de données), `ShieldCheckIcon` (10 critères éthiques — déjà utilisée en ce sens dans `app/page.tsx` phase1), `RouteIcon` (9 étapes guidées — nouvelle association, cohérente avec le motif sentier, distincte du `RocketIcon`/`BarChart3Icon` déjà pris par le wizard).
- Bande mobile compacte : même wash de gradient, motif rogné (juste 3-4 jalons visibles, pas les cercles concentriques) pour rester léger visuellement sur petit écran.
- Aucune nouvelle teinte : uniquement `primary`, `chart-2`, `foreground`, `muted` avec opacités (`/10`, `/12`, `/20`, `/25`, `/30`).

## Données réelles utilisées (champs du client généré)
Cette surface ne consomme aucune donnée dynamique du client généré (formulaires purs, aucun `GET` avant soumission). Les seuls « chiffres » affichés sont des faits produit constants déjà vrais et déjà énoncés ailleurs dans l'app (pas d'invention) :
- 6 datasets seedés (Iris, Titanic, Student Performance, Pima, Wine Quality, Penguins) → « 6 jeux de données réels ».
- 10 critères éthiques tristate (cf. `_SHARED.md`, catalogue datasets) → « 10 critères éthiques ».
- 9 étapes du wizard (`STEP_ICONS` dans `wizard-shell.tsx`, 9 entrées) → « 9 étapes guidées ».
- Note recherche : fait identique à `landing.research` (« Issu d'un projet de recherche — M2 MIAGE, Université Paris 1 Panthéon-Sorbonne »).

Aucun appel `lib/api/generated` ajouté ; `forgotPassword`/`resetPassword` déjà utilisés dans les pages restent inchangés.

## Nouvelles clés i18n (liste fr — l'implémenteur fera en)
Sous un nouveau sous-objet `auth.panel.*` (≈ 8 clés) :
- `auth.panel.tagline` — "Former un modèle, comprendre chaque choix."
- `auth.panel.subtitle` — "IBIS-X vous accompagne du choix éthique du dataset jusqu'à l'explication du modèle."
- `auth.panel.proofDatasets` — "6 jeux de données réels, documentés"
- `auth.panel.proofEthics` — "10 critères éthiques évalués"
- `auth.panel.proofSteps` — "9 étapes guidées, pas à pas"
- `auth.panel.researchNote` — "Issu d'un projet de recherche — M2 MIAGE, Université Paris 1 Panthéon-Sorbonne."
- `auth.panel.compactLabel` — "9 étapes guidées" (texte court affiché uniquement dans la bande mobile, à côté du logo)
- (optionnel, si toggle mot de passe) `auth.showPassword` / `auth.hidePassword` — libellés `aria-label` du bouton œil.

Aucune clé existante renommée ni supprimée : `auth.signUp`, `auth.signIn`, `auth.email`, `auth.password`, etc. restent strictement identiques.

## Risques (e2e, parité i18n, perfs) + parades
- **e2e (`/register` sur le parcours)** : le passage de `Input` brut à `InputGroup > InputGroupInput` ne change ni le tag `<input>`, ni `type="email"`/`type="password"`, ni les props spread (`InputGroupInput` = `Input` avec juste un wrapper visuel — cf. `apps/web/components/ui/input-group.tsx` lignes 131-145). Le bouton `auth.signUp` garde son texte exact ; si une icône y est ajoutée, elle doit être un `<svg aria-hidden>` sans `<title>` pour ne pas altérer l'accessible name lu par `getByRole("button", { name: t(m, "auth.signUp") })`. **Parade** : ne pas toucher au texte ni ajouter de `aria-label` concurrent sur ce bouton.
- **Parité i18n** : les ~8 nouvelles clés `auth.panel.*` doivent être ajoutées à l'identique dans `messages/fr.json` ET `messages/en.json` (test vitest de parité). **Parade** : les ajouter dans le même commit, aux mêmes chemins imbriqués.
- **Contraste clair/sombre** : le panneau utilise désormais des opacités sur `primary`/`chart-2`/`foreground` au lieu d'une image ; à vérifier visuellement dans les deux thèmes après implémentation (le texte reste en `foreground`/`muted-foreground` standard, jamais sur `primary` plein, donc pas de calcul de contraste custom nécessaire).
- **Perf** : le motif est un SVG inline (pas d'asset réseau) — c'est un gain net par rapport à l'image JPEG actuelle (`/images/extra/image4.jpg`, chargée en pleine résolution 1000×1000 sur toute la hauteur d'écran). Ne pas laisser le fichier image orphelin bloquer quoi que ce soit : il peut rester dans `public/images/extra/` (d'autres démos du template purgées n'y touchent plus), juste ne plus être référencé par `guest-shell.tsx`.
- **`GuestGuard`** (`apps/web/components/ibis/auth-guard.tsx`) affiche un `FullPageLoader` générique avant le montage de `GuestShell` — hors périmètre de cette surface, mais à signaler : cet écran de chargement reste sobre/skeleton et ne porte pas la nouvelle identité ; acceptable (transition courte), non traité ici.
- **`reset-password`** : le fallback `<Suspense>` (`Skeleton` `mx-auto mt-24 h-64 w-full max-w-md`, ligne 102) est hors du `GuestShell` donc n'affiche pas le panneau pendant le chargement des `searchParams` — comportement inchangé, acceptable (chargement quasi instantané en client).

## Primitives ui manquantes à copier depuis la source template
Aucune. `Field`/`FieldLabel`/`FieldDescription` (`apps/web/components/ui/field.tsx`) et `InputGroup`/`InputGroupAddon`/`InputGroupButton`/`InputGroupInput` (`apps/web/components/ui/input-group.tsx`) sont déjà présents dans `apps/web` et strictement suffisants.
