# Brief partagé — Refonte visuelle IBIS-X v2 (À LIRE INTÉGRALEMENT)

Tu es un **subagent d'analyse design**. Tu ne codes RIEN. Tu produis une **proposition de refonte visuelle** structurée pour UNE surface, écrite dans un fichier markdown. Un autre agent implémentera plus tard.

## Le produit
IBIS-X accompagne des **non-experts en ML** de bout en bout : catalogue de datasets à **critères éthiques** (10 critères tristate) → **projets** (scoring multi-critères pondéré + recommandations) → **wizard d'entraînement 9 étapes** (worker async, console temps réel) → **résultats** (métriques, graphes) → **explicabilité** (SHAP/LIME, KPI de fiabilité, texte adapté au niveau, chat). Recherche M2 MIAGE Paris 1. Ton : **pédagogique, honnête, rassurant — jamais gadget**.

## Chemins (monorepo `/Applications/XAMPP/xamppfiles/htdocs/2026-research-ibisx`)
- Frontend v2 : `apps/web` — Next.js 16, Tailwind 4, shadcn/ui, Recharts, next-intl (FR/EN), next-themes dark mode, zustand. Client API **généré** : `apps/web/lib/api/generated` (jamais de fetch manuel).
- Primitives UI dispo : `apps/web/components/ui/*` (liste riche : card, table, tabs, timeline, chart, badge, progress, empty, item, field, sheet, hover-card, carousel, avatar, accordion, sonner…). Composants métier : `apps/web/components/ibis/*`.
- **Mine d'or #1 — v1 Angular** (dispositions/idées, PAS le CSS/couleurs) : `/Applications/XAMPP/xamppfiles/htdocs/2025-research-exai/frontend/src/app/pages/` (dossiers `datasets/`, `projects/`, `ml-pipeline/` [`experiments-list`, `experiment-results`, `ml-pipeline-dashboard`, `landing`, `presentation`], `profile/`, `admin/`, `home/`, `analytics/`, `authentication/`, `documentation/`).
- **Mine d'or #2 — source template** (~20 dashboards finis à piller) : `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/dashboard/(auth)/` → `ecommerce`, `crm`, `crypto`, `academy`, `hotel`, `finance`, `hospital-management`, `logistics`, `real-estate`, `sales`, `website-analytics`, `widgets`, `project-list`, `project-management`, `default`, `file-manager`, `apps/` (mail/chat/kanban/notes/calendar), `pages/` (users/profile/settings/pricing…). Primitives source : `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/components/ui/` (identiques à celles de apps/web ; si une manque dans apps/web, on la copiera).

## RÈGLES ABSOLUES (non négociables)
1. **Tokens/couleurs/typos/thème INTOUCHABLES.** Aucun hex arbitraire, aucune police nouvelle. La créativité = **composition** (dispositions, hiérarchie, états, micro-détails).
2. **⚠️ THÈME PAR DÉFAUT MONOCHROME.** `DEFAULT_THEME.preset="default"` ⇒ dans `:root`, `--chart-1..5` sont des **nuances NEUTRES** (base-950, base-600, base-800, base-400, base-300), PAS des teintes vives. Donc « différencier par domaine » = **nuance (chart-1..5) + motif SVG local + icône lucide + monogramme**, jamais par des couleurs inventées. C'est un design **tonal & textural** (façon Linear/Vercel), pas arc-en-ciel. Les gradients se font sur `var(--chart-N)`, `primary`, `muted`, `foreground` avec opacités (`/10`, `/15`…). Tout doit rester impeccable en **clair ET sombre**.
3. **Données réelles uniquement.** Jamais de chiffres/photos/logos inventés. Pour habiller : **gradients + motifs SVG locaux** sur tokens, icônes lucide, initiales/monogrammes. Rien qui simule un contenu inexistant. (6 datasets seedés : Iris, Titanic, Student Performance, Pima, Wine Quality, Penguins.)
4. **i18n stricte** : tout texte via `useTranslations`, clés dans `messages/fr.json` ET `messages/en.json` (test vitest de parité). Zéro chaîne en dur.
5. **e2e mission vert** (`apps/web/e2e/mission.spec.ts`). Sélecteurs = libellés i18n + rôles ARIA. Voir §"Contrats e2e" ci-dessous.
6. **Zéro régression fonctionnelle** : on réorganise l'AFFICHAGE. Ni logique, ni appels API, ni routes modifiés. Le client généré est la seule source de données.
7. **Dark mode auto** : tokens only ⇒ suit tout seul.

## Le référentiel qualité = le wizard (NE PAS refaire)
`apps/web/components/ibis/wizard/wizard-shell.tsx` (+ `steps-1-5.tsx`, `steps-6-8.tsx`). Ce qu'il démontre et qu'il faut ÉGALER : rail latéral sticky à états (current/done/reachable/locked), **anneau de progression SVG** en tokens (`ProgressRing`), header à **tuile-icône** (`bg-primary/10 text-primary rounded-xl` + icône lucide size-6 + titre `text-xl font-semibold tracking-tight` + sous-titre `text-muted-foreground text-sm`), footer sticky, `MissionStepper`. Densité, micro-états, `backdrop-blur`, `sticky`. **Le niveau de chaque page doit être ≥ ce wizard.**

## Composant partagé imposé
`apps/web/components/ibis/mission-stepper.tsx` — fil `Projet → Dataset → Entraînement → Explication` (clé i18n `projects.mission.*`). À réutiliser sur les pages du parcours.

## Contrats e2e (à préserver ABSOLUMENT si ta page est sur le parcours)
- `/register` : `input[type=email]`, `input[type=password]`, bouton `auth.signUp`.
- `/onboarding` : texte `onboarding.title` visible ; `onboarding.education.master` (cliquable exact) ; bouton `common.next` (exact) ; `input[type=number]` ; `onboarding.familiarity.4` (exact) ; bouton `onboarding.submit`. Redirige vers `/dashboard`.
- `/projects/new` : `getByPlaceholder(projects.form.namePlaceholder)` ; **deux boutons libellés exactement `→`** (navigation étapes) ; bouton `projects.form.create` ; redirige vers `/projects/{uuid}`.
- Recommandations (dans `/projects/[id]`) : chaque reco est un `[data-slot="card"]` contenant le nom du dataset (ex. texte `Iris` exact) et un **lien** (role=link) libellé `scoring.train` menant au wizard.
- Résultats `/experiments/[id]` : texte `experiments.resultsTitle` + `experiments.metrics.accuracy` visibles ; **onglet** (role=tab) `experiments.tabXai`.
- XAI : bouton `xai.request.launch` ; texte `xai.kpis.title` ; titre `xai.charts.importance` (avant `" ("`) ; bouton `xai.chat.start` ; `getByPlaceholder(xai.chat.placeholder)` ; bouton `xai.chat.send` (exact) ; texte `xai.chat.waiting`.
> Si ta refonte déplace un de ces éléments, **signale-le en RISQUE** avec la correction e2e minimale (jamais affaiblir le test).

## Ta méthode (obligatoire)
1. Lis la/les page(s) v2 actuelle(s) : `apps/web/app/...` + composants `apps/web/components/ibis/...` associés. Repère les **données réelles** exposées par le client généré (champs disponibles) et les libellés i18n déjà là.
2. Fouille la page **v1** équivalente : décris sa **disposition** (hiérarchie, zones, mise en scène) — utile, pas son CSS.
3. Fouille **2 à 3 démos template** pertinentes : identifie les **patterns précis** à réutiliser, avec **chemins de fichiers exacts** et nom du bloc (ex. « la stat card de `ecommerce/page.tsx` lignes X-Y », « le header détail de `real-estate/[id]/...` »).
4. Rends une proposition. **Signature visuelle unique** : chaque page doit avoir une identité distincte (aucune ne se ressemble) tout en gardant UN langage graphique global.

## Livrable
Écris ta proposition dans le fichier qui t'est indiqué (`docs/refonte/NN-nom.md`), structuré ainsi :
```
# NN — <Surface>
## Signature visuelle (1 phrase forte + 3-5 mots-clés)
## Disposition cible (wireframe ASCII)
## Blocs template à reprendre (fichier exact → quoi en extraire)
## Composants ibis à créer / modifier (chemins)
## Palette tonale & motifs (mapping chart-1..5 / patterns SVG, en monochrome)
## Données réelles utilisées (champs du client généré)
## Nouvelles clés i18n (liste fr — l'implémenteur fera en)
## Risques (e2e, parité i18n, perfs) + parades
## Primitives ui manquantes à copier depuis la source template (le cas échéant)
```
Écris en **français**, dense et actionnable (l'implémenteur ne relira pas la v1). Chemins exacts obligatoires.

## Ce que tu RENDS à l'orchestrateur (message final, court — max ~120 mots)
- 1 ligne : **signature** choisie.
- La ou les **démos template** pillées (noms).
- Le **pattern SVG/tonal** principal revendiqué (ex. « cartes à motif points + gradient chart-2 »), pour détecter les collisions entre pages.
- Nombre approx. de nouvelles clés i18n.
- Risques e2e/i18n majeurs (ou « aucun »).
Ne recopie PAS toute la proposition dans le message : elle est dans le fichier.
