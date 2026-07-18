# 03 — Onboarding `/onboarding`

## Signature visuelle (1 phrase forte + mots-clés)
Une **carte de calibration unique** posée sur un fond à motif d'arcs concentriques (comme des cercles d'étalonnage), qui progresse à travers 3 questions incarnées par des cartes-choix (icône + libellé + description) et une jauge de familiarité qui s'assombrit avec le niveau — **jamais** le rail vertical du wizard, **jamais** le split-screen photo de l'auth.
Mots-clés : *calibration, cartes incarnées, jauge progressive, pastilles de parcours, fond à arcs doux*.

## Disposition cible (wireframe ASCII)
```
┌──────────────────────────── bg-muted/20 + motif SVG arcs concentriques (foreground/[0.03]) ─────────────────────────────┐
│                                                                                                                          │
│                                            Logo  IBIS-X                                                                 │
│                                                                                                                          │
│              ●───────────────○───────────────○         ← pastilles de parcours (3 nœuds, pas 9)                        │
│           Études            Âge            Niveau IA      icône mini par nœud (GraduationCap/CalendarDays/Gauge)        │
│                                                                                                                          │
│   ┌──────────────────────────────────────────────────────────────────────────────────────────┐                        │
│   │  [ tuile-icône bg-primary/10 rounded-xl, icône = celle de l'étape courante ]               │                        │
│   │  onboarding.title (h1)                                                                     │  ← header carte,      │
│   │  onboarding.subtitle (texte muted)                                                         │    même code que      │
│   │  ────────────────────────────────────────────────────────────────────────                 │    wizard-shell l.207 │
│   │                                                                                             │                        │
│   │  Étape 1 — educationTitle / educationHelp                                                  │                        │
│   │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐                     │                        │
│   │  │ 🎓 School │ │ 📖 Book   │ │ 🎓 GradCap│ │ 🔬 Microsc│ │ ✨ Sparkl │  ← grille 2/3 col,     │                        │
│   │  │ Lycée     │ │ Licence   │ │ Master    │ │ Doctorat  │ │ Autre     │    RadioGroupItem       │                        │
│   │  │ (desc.)   │ │ (desc.)   │ │ (desc.)   │ │ (desc.)   │ │ (desc.)   │    peer sr-only          │                        │
│   │  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘                     │                        │
│   │                                                                                             │                        │
│   │  Étape 2 — ageTitle / ageHelp                                                               │                        │
│   │        [ − ]   ┌─────────────┐   [ + ]        (stepper autour de l'input[type=number])      │                        │
│   │                │     28      │                 ageReassurance (texte rassurant, muted)       │                        │
│   │                └─────────────┘                                                              │                        │
│   │                                                                                             │                        │
│   │  Étape 3 — familiarityTitle / familiarityHelp                                               │                        │
│   │  ┌─ Item row ─────────────────────────────────┐   1 Sprout   → clair (chart-5)               │                        │
│   │  ┌─ Item row ─────────────────────────────────┐   2 Puzzle                                    │                        │
│   │  ┌─ Item row ─────────────────────────────────┐   3 Compass                                   │                        │
│   │  ┌─ Item row ─────────────────────────────────┐   4 Rocket                                    │                        │
│   │  ┌─ Item row ─────────────────────────────────┐   5 BrainCircuit → foncé (chart-1)             │                        │
│   │  [ carte aperçu audiencePreview.* qui apparaît sous la liste au clic ]                        │                        │
│   │                                                                                             │                        │
│   │  ────────────────────────────────────────────────────────────────────────                 │                        │
│   │  [ Retour ]                                                    [ Suivant / Commencer ]     │  ← footer intra-carte, │
│   └──────────────────────────────────────────────────────────────────────────────────────────┘    PAS sticky (≠wizard)│
│                                                                                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Blocs template à reprendre (fichier exact → quoi en extraire)
- `shadcn-ui-kit-dashboard-main/.../app/dashboard/(auth)/pages/onboarding-flow/components/account-type-step.tsx` **lignes 44-73** : le pattern exact de « carte de choix incarnée » — `RadioGroupItem value={...} className="peer sr-only"` + `<Label htmlFor=... className="peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:border-primary hover:border-primary flex cursor-pointer flex-col items-start ...">` contenant icône + titre + description. **C'est LE bloc à reprendre pour l'étape éducation** (remplacer l'emoji par une icône lucide dans une tuile `ItemMedia variant="icon"` ou `bg-muted rounded-md`, remplacer `type.title`/`type.description` par `t(\`education.${level}\`)` isolé dans un `<span>` propre — impératif pour le sélecteur e2e exact).
- Même fichier, header d'étape **lignes 44-49** : petit rond `bg-primary` + icône blanche + `h1` — inspire le motif « pastille d'étape » réutilisé dans le nav 3-nœuds (mais en plus petit, x3, avec états done/current/upcoming empruntés à `wizard-shell.tsx` lignes 131-141).
- `.../pages/onboarding-flow/components/interests-step.tsx` **lignes 52-66** : grille de cartes cliquables (sans RadioGroup, simple div + onClick + classe conditionnelle `bg-primary/10 border-primary`) — utile comme alternative si `peer-data-[state=checked]` s'avère trop rigide pour le style « rangée » de l'étape familiarité ; on reste toutefois sur `RadioGroup` (contrôlé, accessible, cohérent avec l'existant).
- `shadcn-ui-kit-dashboard-main/.../app/dashboard/(auth)/pages/settings/appearance/page.tsx` **lignes 111-134** : variante « carte radio avec preview + libellé centré sous la carte » — confirme le pattern `[&:has([data-state=checked])>div]:border-primary` comme alternative au `peer`. On garde `peer` (plus simple, un seul niveau).
- `shadcn-ui-kit-dashboard-main/.../app/dashboard/(auth)/academy/components/welcome-card.tsx` **lignes 9-19** : ton d'accueil chaleureux (« Hi, Andrew 👋 » + phrase d'orientation + sous-texte rassurant) — inspire le couple `title`/`subtitle` déjà présent dans les clés i18n, à ne pas retoucher.
- `apps/web/components/ibis/wizard/wizard-shell.tsx` **lignes 45-64 (`ProgressRing`)** et **lignes 206-219 (tuile-icône + h1 + sous-titre)** : c'est LE niveau de référence à égaler pour le header de carte (tuile `bg-primary/10 text-primary rounded-xl` + icône `size-6` + `text-xl font-semibold tracking-tight` + sous-titre `text-muted-foreground text-sm`) — copié tel quel dans le header de la carte onboarding, mais l'icône change selon l'étape (nouvel ensemble d'icônes, pas `STEP_ICONS` du wizard).
- v1 Angular `home.component.html` **lignes 20-23 et 61-71** : ton d'accueil + éléments décoratifs légers autour du contenu central — traduit ici en motif SVG discret (arcs de calibration) plutôt qu'en étoiles/particules littérales (règle #3 : pas de décor gadget, mais on garde l'esprit « contenu central mis en valeur par un halo »).

## Composants ibis à créer / modifier (chemins)
- `apps/web/app/onboarding/page.tsx` — refonte du composant `OnboardingWizard` (layout, header à tuile-icône, footer non sticky, appel des nouveaux sous-composants). Guard `OnboardingGuard` inchangé.
- `apps/web/components/ibis/onboarding/onboarding-path.tsx` **(nouveau)** — les 3 pastilles de parcours horizontales (icône + libellé court + état done/current/upcoming), inspirées de `wizard-shell.tsx` lignes 131-141 mais en 3 nœuds avec libellés visibles (pas juste un numéro).
- `apps/web/components/ibis/onboarding/choice-card.tsx` **(nouveau)** — wrapper réutilisable `RadioGroupItem peer sr-only` + `Label` carte (icône, titre isolé en `<span>` pour préserver le texte exact, description optionnelle). Utilisé pour l'étape éducation (grille) ET stylable en variante « rangée » pour l'étape familiarité (via prop `orientation="row" | "grid"`).
- `apps/web/components/ibis/onboarding/age-stepper.tsx` **(nouveau)** — wrapper autour de l'`Input type="number"` existant avec boutons `−`/`+` (icônes `MinusIcon`/`PlusIcon`, `aria-label` dédiés) qui incrémentent/décrémentent `age`. L'`input[type=number]` reste unique et natif (contrat e2e).
- `apps/web/components/ibis/onboarding/calibration-pattern.tsx` **(nouveau)** — le fond SVG local (arcs concentriques), positionné en `absolute inset-0 -z-10 pointer-events-none`, purement décoratif.
- `apps/web/components/ui/item.tsx` — réutilisé tel quel (`Item`, `ItemMedia variant="icon"`, `ItemTitle`, `ItemDescription`) pour les rangées de l'étape familiarité ; aucune modification de la primitive.

## Palette tonale & motifs (mapping chart-1..5 / patterns SVG, en monochrome)
- **Tuile-icône du header de carte** : `bg-primary/10 text-primary` (identique au wizard) — l'icône change selon l'étape courante : `GraduationCapIcon` (éducation), `CalendarDaysIcon` (âge), `GaugeIcon` (familiarité).
- **Icônes des 5 niveaux d'études** : `SchoolIcon` (lycée), `BookOpenIcon` (licence), `GraduationCapIcon` (master), `MicroscopeIcon` (doctorat — clin d'œil recherche MIAGE), `SparklesIcon` (autre). Toutes dans une tuile `bg-muted text-muted-foreground` au repos, `bg-primary/10 text-primary` à l'état sélectionné (`peer-data-[state=checked]`) — pas de couleur par domaine, juste la forme de l'icône qui différencie.
- **Icônes des 5 niveaux de familiarité, dégradé de gravité tonale** (idée forte, raconte la progression) : `SproutIcon` (1) → `PuzzleIcon` (2) → `CompassIcon` (3) → `RocketIcon` (4) → `BrainCircuitIcon` (5), avec la tuile `ItemMedia` qui **s'assombrit avec le niveau** : niveau 1 → `bg-[var(--chart-5)]/15 text-[var(--chart-5)]` (le plus clair), niveau 3 → `bg-[var(--chart-3)]/15`, niveau 5 → `bg-[var(--chart-1)]/15 text-[var(--chart-1)]` (le plus foncé). Sélection active : `border-primary bg-primary/5` par-dessus (comme le reste du kit).
- **Pastilles de parcours (3 nœuds)** : reprend exactement les états `done/current/locked` de `wizard-shell.tsx` (`border-primary bg-primary text-primary-foreground` / `border-primary/40 bg-primary/10 text-primary` / `border-border`), mais horizontal et à 3 nœuds avec libellé texte visible sous chaque pastille (pas seulement un chiffre).
- **Motif de fond** : arcs concentriques SVG (`<circle>` non remplis, `stroke="currentColor"` `opacity` dégressive ~0.03-0.06) centrés derrière la carte, en `text-foreground`. Sémantique volontaire : des cercles d'étalonnage/calibration, cohérent avec le rôle réel de l'onboarding (calibrer le niveau d'explication IA) — pas un décor gratuit. Rien d'autre (pas de photo, pas de gradient coloré).
- **Carte d'aperçu `audiencePreview`** : `bg-muted rounded-md p-4` existant, à enrichir d'une tuile icône (`SparklesIcon` ou icône du niveau sélectionné) + un petit libellé eyebrow (nouvelle clé) pour lui donner le poids d'une « récompense » de fin d'étape plutôt qu'un simple paragraphe.

## Données réelles utilisées (champs du client généré)
- `completeOnboarding({ body: { education_level, age, ai_familiarity } })` — inchangé, aucune donnée inventée.
- `EducationLevel` (type généré) — 5 valeurs `lycee | licence | master | doctorat | autre`, déjà exhaustives, mappées 1:1 aux icônes ci-dessus.
- Réponse `data` (utilisateur) → `setUser(data)` puis redirection `/dashboard` — logique intacte, zéro changement d'API/route.

## Nouvelles clés i18n (liste fr — l'implémenteur fera en)
```
onboarding.ageReassurance: "Sert uniquement à adapter le ton des explications — jamais partagé."
onboarding.ageStepper.increment: "Augmenter l'âge"
onboarding.ageStepper.decrement: "Diminuer l'âge"
onboarding.pathLabels.education: "Études"
onboarding.pathLabels.age: "Âge"
onboarding.pathLabels.familiarity: "Niveau IA"
onboarding.audiencePreviewEyebrow: "Aperçu de vos explications"
```
(~7 nouvelles clés ; toutes les clés existantes — `title`, `subtitle`, `step`, `educationTitle`, `educationHelp`, `education.*`, `ageTitle`, `ageHelp`, `ageLabel`, `familiarityTitle`, `familiarityHelp`, `familiarity.*`, `audiencePreview.*`, `submit`, `submitting` — restent identiques, aucun renommage.)

## Risques (e2e, parité i18n, perfs) + parades
- **Risque majeur — texte exact des options.** Le contrat e2e clique `onboarding.education.master` et `onboarding.familiarity.4` via `getByText(..., { exact: true })`. Dans le pattern « carte incarnée » (icône + titre + description dans le même `Label`), il est impératif que le libellé (`t("education.master")`, `t("familiarity.4")`) reste isolé dans son **propre élément** (`<span>` ou `<ItemTitle>`) sans être concaténé à la description dans le même nœud texte — sinon `exact: true` ne matchera plus rien. Parade : ne jamais mettre titre + description dans le même `<p>`/`<span>` ; toujours `<ItemTitle>{t(...)}</ItemTitle>` séparé de `<ItemDescription>`.
- **Risque — bouton `common.next`.** Ne pas transformer ce bouton en icône seule ni cacher son texte en responsive (`hidden sm:inline` comme dans `wizard-shell.tsx` l.231, qui est un display:none donc exclu du nom accessible sur mobile) : garder le texte `{tCommon("next")}` toujours visible, icône décorative optionnelle en plus, jamais en remplacement.
- **Risque — `input[type=number]` unique.** Le stepper `age-stepper.tsx` ne doit ajouter **aucun** second `<input>` de type number (les boutons `−`/`+` sont des `<button>` qui appellent `setAge`) : un seul `input[type=number]` doit rester présent dans le DOM à l'étape 2.
- **Risque — bouton `onboarding.submit`.** Le test clique sans `exact: true` sur ce libellé (`page.getByRole("button", { name: t(m,"onboarding.submit") })`) : ne pas ajouter de préfixe/suffixe qui romprait un futur test strict, mais rester conforme puisqu'en état non-`submitting` le texte du bouton est exactement `t("submit")` — inchangé.
- **Parité i18n** : les 7 nouvelles clés doivent être ajoutées à `fr.json` ET `en.json` (test vitest de parité) — l'implémenteur doit veiller à l'ordre des clés identique dans les deux fichiers.
- **Perf/aucun** : motif SVG en `<svg>` inline (pas d'image), aucune requête réseau supplémentaire, aucun impact.

## Primitives ui manquantes à copier depuis la source template (le cas échéant)
Aucune — `radio-group.tsx`, `item.tsx`, `field.tsx`, `card.tsx`, `progress.tsx`, `label.tsx` sont déjà présents dans `apps/web/components/ui/` et suffisent à toute la refonte proposée.
