# 14 — Pages d'état `404` / `error`

## Signature visuelle (1 phrase forte + 3-5 mots-clés)
Un panneau tramé à motif pointillé (mine d'or #2 : le 404 des démos `pages/error`) où un **monogramme SVG maison** — chiffres `404` ou icône « circuit cassé » pour l'erreur — flotte en tons neutres `chart-N`, avec une seule sortie possible : le tableau de bord. Mots-clés : **trame pointillée, monogramme tonal, cul-de-sac interdit, pédagogique, rassurant**.

## Contexte actuel (v2)
- `apps/web/app/not-found.tsx` : `main` centré vertical/horizontal, texte `404` en `font-mono text-sm`, `h1` = `states.notFoundTitle`, `p` = `states.notFoundBody`, `Button variant="outline" asChild` → `Link href="/"` = `states.backHome`. Server component (`getTranslations`).
- `apps/web/app/error.tsx` : même layout, `"use client"`, `500` en mono, `states.errorTitle`, `states.errorBody`, `Button variant="outline" onClick={reset}` = `states.retry`. Pas de lien de sortie — **c'est un cul-de-sac** (seul `reset()` est proposé, aucun moyen de fuir si `reset()` reboucle sur la même erreur).
- Les deux fichiers sont à la racine de `app/`, **hors** `(app)` et `(guest)` — aucun header/sidebar, aucun contexte d'auth serveur disponible facilement. Le root `app/page.tsx` (landing publique) est toujours accessible sans guard ; `/dashboard` redirige proprement vers `/login` via `AppGuard` si l'utilisateur n'est pas connecté (`components/ibis/auth-guard.tsx`) — donc lier vers `/dashboard` est sûr dans tous les cas et plus utile pour un utilisateur déjà connecté que la landing marketing.
- Clés i18n existantes (namespace `states`, `messages/fr.json` + `messages/en.json`) : `notFoundTitle`, `notFoundBody`, `backHome`, `errorTitle`, `errorBody`, `retry`. Aucune clé `errors.*` — le namespace réel est `states.*`.
- **Aucune référence e2e** : `apps/web/e2e/mission.spec.ts` ne touche ni `/not-found`, ni `error.tsx`, ni le namespace `states`. Risque e2e nul sur cette surface.

## Disposition cible (wireframe ASCII)

Deux variantes cohérentes (même grammaire, signaux distincts), plein écran, centrées, sans sidebar (comme aujourd'hui) :

```
┌──────────────────────────── 404 ────────────────────────────┐
│                                                                │
│                    ┌─────────────────────┐                    │
│                    │ ░░░░░░░░░░░░░░░░░░░░ │  ← panneau tramé   │
│                    │ ░░  ┌───────────┐ ░░ │    (motif points   │
│                    │ ░░  │  monogr.  │ ░░ │    en chart-N/10)  │
│                    │ ░░  │  SVG 404  │ ░░ │                    │
│                    │ ░░  └───────────┘ ░░ │                    │
│                    │ ░░░░░░░░░░░░░░░░░░░░ │                    │
│                    └─────────────────────┘                    │
│                                                                │
│                  [tuile-icône] Page introuvable                │
│           Cette page n'existe pas ou a été déplacée.          │
│                                                                │
│      [ Retour au tableau de bord ]   [ Retour à l'accueil ]   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────── error ───────────────────────────┐
│                                                                │
│                    ┌─────────────────────┐                    │
│                    │ ░░░░░░░░░░░░░░░░░░░░ │  ← même panneau,   │
│                    │ ░░  ┌───────────┐ ░░ │    monogramme      │
│                    │ ░░  │  circuit  │ ░░ │    « circuit       │
│                    │ ░░  │  brisé    │ ░░ │    brisé » (motif  │
│                    │ ░░  └───────────┘ ░░ │    distinct du 404)│
│                    │ ░░░░░░░░░░░░░░░░░░░░ │                    │
│                    └─────────────────────┘                    │
│                                                                │
│                [tuile-icône] Une erreur est survenue           │
│    Réessayez ; si le problème persiste, contactez un admin.   │
│                                                                │
│         [ Réessayer ]        [ Retour au tableau de bord ]    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

Différence structurelle volontaire : 404 = un seul type de sortie (navigation, 2 boutons de destination) ; error = sortie **action d'abord** (`Réessayer` en bouton primaire) puis fuite (`Retour au tableau de bord` en secondaire) — jamais de cul-de-sac, contrairement à l'existant.

## Blocs template à reprendre (fichier exact → quoi en extraire)
- `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/dashboard/(guest)/pages/error/404/page.tsx` — **le bloc pivot** : panneau `bg-primary/5 border-primary/10 rounded-lg border` avec grille `grid-cols-10 grid-rows-10` de 100 cellules à `border-primary/30 border-1` et `opacity` variable en overlay `absolute inset-0`, gros numéral centré en `z-10`, dégradé de fondu `bg-gradient-to-t from-background/80` en bas du panneau. → **on remplace les 100 divs par un vrai motif SVG `<pattern>` local** (mêmes proportions, dots au lieu de bordures de cellules, pour rester dans l'esprit « SVG maison » du brief plutôt que 100 `div` générées) et le numéral géant par le monogramme SVG.
- `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/not-found.tsx` — structure deux CTA (`size="lg"` primaire + `variant="ghost"` secondaire côte à côte, `flex items-center justify-center gap-x-2`) et hiérarchie typo (`text-base font-semibold` pour le sur-titre `404`, `text-3xl … lg:text-7xl font-bold tracking-tight` pour le H1). On garde la hiérarchie typo mais on la ramène aux tailles déjà en usage côté IBIS-X (`text-2xl font-semibold` du fichier v2 actuel, pas de `text-7xl` disproportionné).
- `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/dashboard/(auth)/pages/error/403/page.tsx` — disposition `figure` centrée au-dessus du titre (`m-auto w-40 lg:w-60`) : confirme le patron illustration-au-dessus-du-texte à reprendre pour `error.tsx`.
- `apps/web/components/ibis/wizard/wizard-shell.tsx` lignes 44-64 (`ProgressRing`) — **technique du cercle SVG en tokens** (`stroke-border` / `stroke-primary`, `strokeDasharray`/`strokeDashoffset`) à réemployer comme composant décoratif dans le monogramme error (cercle incomplet = « connexion rompue ») pour rester dans la grammaire SVG déjà validée par le référentiel qualité.
- Tuile-icône du header wizard (`bg-primary/10 text-primary rounded-xl` + icône lucide `size-6`, `wizard-shell.tsx` ~L170-190) — à reprendre pour le bloc titre sous l'illustration (`SearchXIcon` / `TriangleAlertIcon` dans une tuile arrondie, au lieu du `h1` nu actuel).

## Composants ibis à créer / modifier (chemins)
- **Créer** `apps/web/components/ibis/states/state-illustration.tsx` — composant SVG partagé, prop `variant: "not-found" | "error"`, viewBox unique, panneau tramé + monogramme, 100 % tokens (`currentColor`/`var(--chart-N)`/`var(--border)`/`var(--primary)`), `aria-hidden="true"` (l'illustration est décorative, le texte porte le sens).
- **Créer** `apps/web/components/ibis/states/state-page.tsx` — layout partagé (tuile-icône + h1 + body + rangée de CTA) consommé par `not-found.tsx` et `error.tsx` pour garantir la cohérence entre les deux variantes sans dupliquer le markup.
- **Modifier** `apps/web/app/not-found.tsx` — remonte `StateIllustration variant="not-found"` + `StatePage`, deux CTA (`Link href="/dashboard"` primaire `states.backHome`, `Link href="/"` secondaire `states.backLanding` — nouvelle clé).
- **Modifier** `apps/web/app/error.tsx` — remonte `StateIllustration variant="error"` + `StatePage`, CTA primaire `onClick={reset}` = `states.retry`, CTA secondaire `Link href="/dashboard"` = `states.backHome`.

## Palette tonale & motifs (mapping chart-1..5 / patterns SVG, en monochrome)
- Panneau : `bg-primary/5` + bordure `border-primary/10` (repris tel quel du template, déjà tokens).
- Trame de fond du panneau : `<pattern>` SVG de points (`r=1`, `fill="currentColor"`, classe `text-primary/20`), pas de 100 `div` — un seul `<rect fill="url(#pattern)">`, plus léger et plus « fait main ».
- Monogramme 404 : les trois glyphes composés de segments SVG (façon compteur digital sobre) en `stroke-foreground/80`, `stroke-width` fine, cohérents avec le style filaire du `ProgressRing`.
- Monogramme error : cercle `ProgressRing`-like **incomplet** (dasharray coupé aux ~2/3) en `stroke-chart-2`, traversé d'un éclair/rupture (`path` en zigzag) en `stroke-chart-1` — la métaphore « circuit interrompu, on peut réessayer » plutôt qu'un bug gadget.
- Dégradé de fondu bas de panneau : `bg-gradient-to-t from-background/80 to-transparent` (repris du template, tokens).
- Tuile-icône sous l'illustration : `bg-primary/10 text-primary` avec `SearchXIcon` (404) / `TriangleAlertIcon` (error) de lucide, cohérent avec le wizard.
- Aucune couleur vive : tout en `primary`/`foreground`/`border`/`chart-1`/`chart-2` avec opacités, impeccable en clair et sombre par construction (tokens only).

## Données réelles utilisées (champs du client généré)
Aucune — surface 100 % statique, pas d'appel API. Conforme à la règle « données réelles uniquement » (rien n'est inventé, l'illustration est un motif décoratif, pas une donnée).

## Nouvelles clés i18n (liste fr — l'implémenteur fera en)
Namespace `states` (existant), à compléter :
- `states.backLanding` : "Retour à l'accueil" (nouveau libellé pour le CTA secondaire de `not-found.tsx`, distinct de `backHome` qui devient « Retour au tableau de bord »). **Attention** : si `backHome` change de sens (accueil → tableau de bord), vérifier qu'aucune autre page ne consomme `states.backHome` avec l'ancien sens ; sinon créer `states.backDashboard` à la place et garder `backHome` inchangé pour ne rien casser ailleurs.
- `states.errorHint` (optionnel) : petite ligne sous le body error, ex. "Si le problème persiste après plusieurs essais, contactez un administrateur." — seulement si on veut détacher ce sous-message du `errorBody` actuel pour l'alléger.

Total : **1 à 2 clés nouvelles**, le reste (`notFoundTitle`, `notFoundBody`, `errorTitle`, `errorBody`, `retry`) est réutilisé tel quel.

## Risques (e2e, parité i18n, perfs) + parades
- **Réutilisation de `states.backHome`** : grep confirme qu'aujourd'hui seul `not-found.tsx` consomme cette clé. Si son sens change (accueil → dashboard), aucune régression ailleurs, mais **par prudence** préférer ajouter `states.backDashboard` plutôt que de redéfinir `backHome`, pour ne pas surprendre un futur usage. Choix laissé à l'implémenteur, à trancher avant merge.
- **e2e** : aucun test ne cible `/not-found` ou `error.tsx` (`apps/web/e2e/mission.spec.ts` grep vide) → risque nul, aucune parade nécessaire.
- **Parité i18n** : test `apps/web/tests/i18n-messages.test.ts` vérifie fr/en en miroir → toute nouvelle clé doit être ajoutée dans les deux fichiers dans le même mouvement.
- **Perf** : SVG inline, pas d'images externes, aucun fetch — zéro impact perf. Le panneau tramé est un motif SVG unique (`<pattern>`), beaucoup plus léger que les 100 `div` du template source.
- **Accessibilité** : illustration `aria-hidden="true"` + titre/`body` restent le seul porteur de sens pour lecteurs d'écran ; CTA gardent des libellés explicites (pas juste une icône).

## Primitives ui manquantes à copier depuis la source template (le cas échéant)
Aucune — tout se construit avec `Button` (déjà dans `apps/web/components/ui/`), des icônes `lucide-react` déjà dépendance du projet, et du SVG inline maison (pas de primitive `components/ui/` supplémentaire nécessaire, `Empty` de `apps/web/components/ui/empty.tsx` n'est pas adapté ici car pensé pour des listes vides in-page, pas des pages d'état plein écran avec double CTA).
