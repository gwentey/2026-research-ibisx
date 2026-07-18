# 01 — Landing `/`

## Signature visuelle (1 phrase forte + 3-5 mots-clés)
La landing ne vend pas une promesse abstraite : elle **montre le produit réel** (rail du wizard + graphe d'importance reconstruits en composants tokens, dans une carte « fenêtre d'application ») posé sur un fond à **motif de points tonal**, puis déroule le **même fil de mission** (Projet→Dataset→Entraînement→Explication) que le reste de l'app.
Mots-clés : **aperçu produit fidèle · motif de points · fenêtre d'app · fil de mission · honnêteté assumée**.

## Disposition cible (wireframe ASCII)

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Logo] IBIS-X                                    [FR/EN] [Se connecter] [Commencer] │  header sticky, backdrop-blur (identique esprit wizard-shell footer)
├────────────────────────────────────────────────────────────────────────┤
│                    ░░░░░░ fond motif de points (chart-3/10) ░░░░░░      │
│         [Badge 🎓 landing.research]                                     │
│              H1 landing.tagline                                        │
│              p  landing.subtitle                                       │
│         [Commencer →]   [Ouvrir l'application]                         │
│                                                                          │
│   ┌── Card "fenêtre d'app" (device frame) ─────────────────────────┐   │
│   │ ● ● ●     wizard.title · wizard.stepOf(6,9)      [Exemple]     │   │  barre de titre (3 points + libellé réel)
│   ├─────────────┬───────────────────────────────────────────────────┤   │
│   │ rail mini   │  tuile-icône + wizard.steps.6 + subtitles.6        │   │  réplique wizard-shell (rail gauche + header tuile)
│   │ 1..9 (done/ │  ┌ mini bar chart horizontal (xai.charts.importance)│  │  réplique explanation-view (Bar + YAxis feature)
│   │ current/    │  │  sepal_length ▓▓▓▓▓▓▓▓                          │  │
│   │ locked)     │  │  petal_width  ▓▓▓▓▓                             │  │
│   │             │  │  petal_length ▓▓▓                               │  │
│   └─────────────┴───────────────────────────────────────────────────┘   │
│              landing.preview.caption (petit texte sous la carte)        │
├────────────────────────────────────────────────────────────────────────┤
│  landing.journey.title / subtitle                                       │
│  [Folder] Projet  →  [Database] Dataset  →  [BrainCircuit] Entraîn. →  [Lightbulb] Explication │
│   (4 cards, langage MissionStepper agrandi, corps = phase*Body existants + 1 nouveau) │
├────────────────────────────────────────────────────────────────────────┤
│  landing.ethics.title / subtitle              (wash chart-2/5)          │
│  [badges] anonymization · transparency · informed_consent ·             │
│           documentation · data_quality · sample_balance                 │
│  → texte "12 critères" (déjà landing.phase1Body) + CTA landing.cta      │
├────────────────────────────────────────────────────────────────────────┤
│  landing.honesty.title                                                  │
│  [card] Fallback assumé   [card] Reproductible   [card] Fiabilité mesurée│
├────────────────────────────────────────────────────────────────────────┤
│  footer : landing.research (repris, sobre)                              │
└────────────────────────────────────────────────────────────────────────┘
```

Sur mobile : hero en 1 colonne, carte « fenêtre d'app » passe le rail mini en bandeau horizontal (même logique que le `lg:hidden` de `wizard-shell.tsx` lignes 184-203), les 4 cards du parcours passent en pile verticale avec flèche `↓` au lieu de `→`.

## Blocs template à reprendre (fichier exact → quoi en extraire)

- `apps/web/components/ibis/wizard/wizard-shell.tsx` lignes 30-64 (`STEP_ICONS`, `ProgressRing`) : réutiliser tel quel l'icône par étape et le composant `ProgressRing` (SVG cercle en `stroke-primary`/`stroke-border`) dans la mini fenêtre du hero pour l'anneau à côté du titre — **ne pas réinventer un nouveau ring**, importer celui-là.
- `apps/web/components/ibis/wizard/wizard-shell.tsx` lignes 115-145 (rail gauche `STEPS.map` avec pastille numérotée + état `current/done/reachable/locked`) : reproduire en miniature (taille des pastilles réduite `size-5`, texte tronqué) dans la colonne gauche de la carte-mockup, figé sur l'état `visualStep = 6`.
- `apps/web/components/ibis/wizard/wizard-shell.tsx` lignes 206-219 (tuile-icône `bg-primary/10 text-primary rounded-xl` + `h1 text-xl font-semibold` + sous-titre `text-muted-foreground text-sm`) : header de la carte-mockup, avec `t("wizard.steps.6")` / `t("wizard.subtitles.6")` (copie réelle, pas inventée).
- `apps/web/components/ibis/xai/explanation-view.tsx` lignes 152-173 (`BarChart` `layout="vertical"`, `Bar fill="var(--chart-1)"`, `YAxis dataKey="feature"`) : base du mini graphe d'importance dans la carte-mockup. Utiliser `ChartContainer` + `recharts` réels (pas un dessin statique) avec 3-4 barres, features réelles d'un dataset seedé (ex. Iris : `sepal_length`, `sepal_width`, `petal_length`, `petal_width`), hauteur ~120px.
- `apps/web/components/ibis/datasets/dataset-card.tsx` lignes 40-44 (icône `ShieldCheckIcon` + libellé `t("ethical")` + couleur via `scoreColorClass`) : grammaire visuelle à réutiliser pour les badges du bandeau critères éthiques (icône + libellé court), sans le pourcentage puisqu'aucune donnée dataset réelle n'est chargée sur la landing.
- `shadcn-ui-kit-dashboard-main/.../app/dashboard/(auth)/academy/components/welcome-card.tsx` lignes 6-46 : structure « bloc hero en carte » (grid `lg:grid-cols-3`, contenu 2/3 + visuel 1/3, `overflow-hidden`, figure décorative en position `absolute inset-0`) — reprendre la **disposition** (texte à gauche/visuel à droite, décor en fond absolu) mais remplacer `star-shape.png` (image stock) par le motif SVG de points en local (aucune image externe, règle #3).
- `shadcn-ui-kit-dashboard-main/.../app/dashboard/(auth)/academy/components/learning-path-card.tsx` lignes 8-45 (`Card` + `CardAction` icône + `Progress indicatorColor` + lignes cliquables `hover:bg-muted rounded-md border`) : pattern de « ligne cliquable dans une carte » à reprendre pour les 3 cards de la section honnêteté (icône dans `CardHeader`/`CardAction`, corps court, pas de couleur inventée — retirer `indicatorColor` vert/orange, garder `bg-primary` uniquement).
- `shadcn-ui-kit-dashboard-main/.../app/dashboard/(auth)/default/page.tsx` lignes 38 (`gap-4 space-y-4 lg:grid lg:grid-cols-3 lg:space-y-0`) : grille de répartition 3 colonnes à reprendre pour la section honnêteté (3 cards) et la section parcours (grid 4 colonnes en `lg:grid-cols-4`).
- `components/ui/carousel.tsx` du template : **écarté délibérément**. Pas de carrousel ni de marquee auto-défilant sur la landing (aucun bloc `marquee`/logos clients disponible côté template ; en introduire un serait un gadget et une preuve sociale inventée — contraire au ton « jamais gadget » et à la règle #3).

## Composants ibis à créer / modifier (chemins)

- `apps/web/app/page.tsx` — **modifié** : orchestration des sections (hero avec `HeroPreview`, `JourneySection`, `EthicsBand`, `HonestySection`), header/footer conservés à l'identique dans leur fonction (liens `/login`, `/register`, `/dashboard`).
- `apps/web/components/ibis/landing/hero-preview.tsx` — **nouveau** : la carte « fenêtre d'app » (barre de titre 3 points, rail mini + tuile-icône + mini bar chart). Server Component pur (aucune interactivité, aucun `useState`) pour ne pas alourdir le bundle JS de la page publique.
- `apps/web/components/ibis/landing/journey-section.tsx` — **nouveau** : les 4 cards Projet→Dataset→Entraînement→Explication, icônes identiques à `mission-stepper.tsx` (`FolderIcon`, `DatabaseIcon`, `BrainCircuitIcon`, `LightbulbIcon`) reliées par des flèches `→` (desktop) / `↓` (mobile), même vocabulaire que `MissionStepper` sans réutiliser le composant pill lui-même (celui-ci est conçu pour une navigation *active*, pas pour du contenu marketing statique).
- `apps/web/components/ibis/landing/ethics-band.tsx` — **nouveau** : bandeau des 6 critères à connotation éthique (`anonymization`, `transparency`, `informed_consent`, `documentation`, `data_quality`, `sample_balance`), badges `variant="outline"` + icône, fond `bg-gradient-to-b from-chart-2/5 to-transparent`.
- `apps/web/components/ibis/landing/honesty-section.tsx` — **nouveau** : 3 cards (fallback assumé / reproductibilité / fiabilité mesurée).
- `apps/web/components/ibis/landing/dot-grid.tsx` — **nouveau** : motif SVG de points partagé (pattern `<circle>` en `fill-foreground/10`), exporté en composant `<DotGrid className? />` réutilisé par `hero-preview.tsx` (fond du hero) et optionnellement `ethics-band.tsx`.

## Palette tonale & motifs (mapping chart-1..5 / patterns SVG, en monochrome)

- **`chart-1`** : barre du mini graphe d'importance dans la carte-mockup (`fill="var(--chart-1)"`, identique à `explanation-view.tsx`) + anneau de progression (`stroke-primary`, repris tel quel de `ProgressRing`). C'est la touche la plus contrastée de toute la page — réservée à cet endroit pour que l'œil aille directement vers « le produit qui fonctionne ».
- **`chart-2`** : lavis de fond en haut de la carte-mockup (`bg-gradient-to-b from-chart-2/10 to-transparent`) + wash de la section critères éthiques (`from-chart-2/5`).
- **`chart-3`** : motif de points du fond du hero (`fill-foreground/10` sur un pattern de cercles `r=1` espacés de 24px, opacité globale du conteneur ~`opacity-[0.15]`, avec un masque radial qui l'estompe vers les bords pour ne pas parasiter le texte — `mask-image: radial-gradient(ellipse at center, black, transparent 70%)`).
- **`chart-4` / `chart-5`** : nuances secondaires pour les séparateurs (`border-border`) et les icônes au repos (`text-muted-foreground`) des 3 cards honnêteté et des 4 cards parcours — jamais de couleur, uniquement des nuances neutres déjà tokenisées.
- Aucune teinte vive nulle part : le seul signal chromatique fort de la page est `chart-1`/`primary`, concentré sur le mini graphe + les CTA — cohérent avec la règle « différencier par nuance + motif + icône, jamais par couleur inventée ».

## Données réelles utilisées (champs du client généré)

La landing est **publique et non authentifiée** : aucun appel au client généré n'est fait (pas de `useEffect`/fetch). Toutes les données affichées sont soit du **texte i18n déjà réel** (copie produit existante), soit des **métadonnées structurelles réelles et statiques** (noms de colonnes des datasets seedés, noms des étapes du wizard) :
- `wizard.steps.*`, `wizard.subtitles.*`, `wizard.stepOf` (déjà en `messages/fr.json` / `en.json`) — repris tels quels pour la carte-mockup, aucune traduction inventée.
- `xai.charts.importance` (déjà existant) — titre du mini graphe.
- `scoring.criteria.*` (12 clés déjà existantes, cf. `messages/fr.json` → `scoring.criteria`) — labels du bandeau critères éthiques, sous-ensemble des 6 à connotation éthique.
- Noms de colonnes réels d'un dataset seedé (Iris : `sepal_length`, `sepal_width`, `petal_length`, `petal_width`) en labels du mini graphe — réels (proviennent du seed CDC §17), mais les **longueurs de barres sont illustratives** (aucun entraînement n'a eu lieu pour un visiteur non connecté). D'où le badge `landing.preview.exampleBadge` (« Exemple ») explicite sur la carte, exigé par la règle d'honnêteté : on ne doit jamais laisser croire que ce sont des résultats réels d'un modèle.
- `landing.phase1Body` / `phase2Body` / `phase3Body` (déjà existants) — réutilisés comme corps des cards Dataset / Entraînement / Explication de `journey-section.tsx` (seul le corps « Projet » est nouveau, cf. clés ci-dessous).

## Nouvelles clés i18n (liste fr — l'implémenteur fera en)

```
landing.preview.caption      = "Aperçu du produit — reconstitution fidèle en composants, pas une capture d'écran."
landing.preview.exampleBadge = "Exemple"
landing.journey.title        = "Le parcours, en quatre temps"
landing.journey.subtitle     = "Le même fil vous accompagne à chaque étape de l'application."
landing.journey.projectBody  = "Décrivez votre objectif : l'application propose ensuite des datasets pondérés selon vos priorités."
landing.ethics.title         = "Comment nous évaluons les données"
landing.ethics.subtitle      = "Douze critères techniques et éthiques, visibles avant de choisir un dataset."
landing.honesty.title                    = "Une IA qui explique ses limites"
landing.honesty.fallback.title           = "Fallback assumé"
landing.honesty.fallback.body            = "Si SHAP n'est pas disponible pour votre modèle, l'application bascule sur LIME et le signale explicitement — jamais de résultat maquillé."
landing.honesty.reproducibility.title    = "Reproductible"
landing.honesty.reproducibility.body     = "Chaque entraînement fixe la graine aléatoire (random_state=42) : mêmes données, même résultat."
landing.honesty.kpis.title               = "Fiabilité mesurée"
landing.honesty.kpis.body                = "Complétude SHAP, stabilité, fidélité LIME : des indicateurs calculés, pas des promesses."
```
Soit **14 nouvelles clés**, à dupliquer dans `messages/fr.json` ET `messages/en.json` (test de parité `apps/web/tests/i18n-messages.test.ts`). Les titres des 4 cards du parcours réutilisent `projects.mission.project/dataset/training/explanation` (déjà présents) — aucune clé neuve pour les titres.

## Risques (e2e, parité i18n, perfs) + parades

- **e2e** : `apps/web/e2e/mission.spec.ts` ne navigue jamais via `/` (il va directement en `page.goto("/register")` ligne 46 et `/projects/new` ligne 63) → **aucun risque e2e direct** sur cette refonte. Parade préventive : conserver les `Link href="/register"` et `Link href="/login"` avec les libellés `t("cta")`/`t("login")` existants (régression fonctionnelle sinon, même hors contrat e2e).
- **i18n parité** : 14 clés à ajouter en double (fr+en) sous peine d'échec de `tests/i18n-messages.test.ts`. Parade : livrer les deux fichiers dans le même commit, jamais fr seul.
- **Honnêteté des données du mockup** : risque de laisser croire que le mini graphe d'importance est un résultat réel. Parade : badge `landing.preview.exampleBadge` toujours visible sur la carte + `landing.preview.caption` en légende — non négociable, à ne pas retirer en implémentation « pour épurer ».
- **Perf** : le hero-preview ajoute un `recharts` `BarChart` sur la page publique (déjà chargé ailleurs dans l'app, mais la landing ne l'importait pas avant). Parade : composant client isolé le plus petit possible (`"use client"` seulement sur le sous-bloc `BarChart`, le reste de `hero-preview.tsx` reste Server Component) pour limiter le JS envoyé à un visiteur non authentifié.
- **Collision de pattern avec une autre surface** : le motif de points + wash `chart-2` est proposé comme signature *exclusive* de la landing. Si une autre surface du plan de refonte revendique aussi un dot-grid en hero (ex. dashboard), il faudra arbitrer côté orchestrateur — le mini bar-chart en carte-mockup, lui, est sans ambiguïté propre à cette page (il réutilise littéralement `explanation-view.tsx`).

## Primitives ui manquantes à copier depuis la source template (le cas échéant)

Aucune. Tous les primitives nécessaires (`card`, `badge`, `button`, `progress`, `chart`, `separator`) sont déjà présentes dans `apps/web/components/ui/`. Le seul bloc écarté du template (`carousel.tsx` / logique marquee) l'est par choix éditorial (cf. section blocs template), pas par manque technique.
