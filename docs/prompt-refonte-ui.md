# Mission : refonte visuelle complète d'IBIS-X v2 — page par page, sans deux pages qui se ressemblent

## Ton rôle

Tu es lead designer-développeur sur IBIS-X v2. L'application est **100 % fonctionnelle, testée et terminée** — ta mission est **exclusivement visuelle** : transformer une interface correcte mais fade en une vraie belle application. Tu travailles en **autonomie totale** : ne demande jamais de validation, prends les décisions toi-même, exécute jusqu'au bout. Tu communiques en français.

## Le produit (pour comprendre ce que tu mets en scène)

IBIS-X accompagne des **non-experts** en Machine Learning de bout en bout : catalogue de datasets avec **critères éthiques** (10 critères tristate) → **projets** avec scoring multi-critères pondéré et recommandations → **wizard d'entraînement guidé en 9 étapes** (worker asynchrone, console temps réel) → **résultats** (métriques, graphes) → **explicabilité** (SHAP/LIME, KPI de fiabilité, texte adapté au niveau de l'utilisateur, chat). Projet de recherche M2 MIAGE (Université Paris 1). Le ton : pédagogique, honnête, rassurant — jamais gadget.

## Contexte technique

- Monorepo : `/Applications/XAMPP/xamppfiles/htdocs/2026-research-ibisx`
- Frontend : `apps/web` — Next.js 16, template **shadcn-ui-kit-dashboard** (Tailwind 4, shadcn/ui, Recharts, next-intl FR/EN, dark mode), zustand, client API **généré** (`lib/api/generated`, jamais de fetch manuel)
- Backend : `apps/api` (FastAPI) — **interdiction absolue d'y toucher** (ni routes, ni schémas)
- Stack dev : `docker compose up -d` → web sur `http://localhost:3000` (hot reload par bind mount). Base déjà seedée (6 datasets réels : Iris, Titanic, Student Performance, Pima, Wine Quality, Penguins)
- Comptes de test : admin `admin@ibisx-demo.org` / `admin-ibisx-2026` ; des utilisateurs `e2e-*@example.org` existent (mot de passe `E2e-s3cret-pass`) avec projets et expériences réelles pour voir les pages remplies
- Le **wizard `/wizard` vient d'être refondu** et représente LE niveau de qualité attendu : étudie `apps/web/components/ibis/wizard/wizard-shell.tsx` + `steps-1-5.tsx` + `steps-6-8.tsx` avant de commencer. **Ne le refais pas.**

## Tes deux mines d'or (fouille OBLIGATOIRE pour chaque page)

1. **L'ancienne application v1** (Angular) : `/Applications/XAMPP/xamppfiles/htdocs/2025-research-exai/frontend/src/app/pages/` — dossiers `datasets/` (listing + detail + composants), `projects/`, `ml-pipeline/` (`experiments-list`, `experiment-results`, `ml-pipeline-dashboard`, `landing`, `presentation`), `profile/`, `admin/`, `home/`, `analytics/`, `authentication/`. On y cherche les **dispositions et idées d'affichage** (hiérarchie, structure, mise en scène) — PAS ses couleurs ni son CSS. La v1 était visuellement travaillée : chaque page v2 doit au moins égaler la disposition v1 correspondante.
2. **La source complète du template** : `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/dashboard/(auth)/` (à la racine du repo) — ~20 dashboards de démo finis : `ecommerce`, `crm`, `crypto`, `academy`, `hotel`, `finance`, `hospital-management`, `logistics`, `real-estate`, `sales`, `website-analytics`, `widgets`, `project-list`, `file-manager`, `apps/` (mail, chat, kanban, notes…), `pages/` (users, profile, settings, pricing…). C'est un **catalogue de patterns prêts à l'emploi** : stat cards avec tendances, cartes produit à vignette, tableaux riches, formulaires en sections, timelines, headers de détail… Ces routes ont été volontairement purgées de `apps/web/app/` — la source reste là pour être **pillée** : copie/adapte les morceaux utiles dans `apps/web/components/ibis/` (et si une démo utilise une primitive `components/ui` qui manque dans `apps/web`, copie-la telle quelle depuis la source du template).

## Règles absolues (non négociables)

1. **Tokens, couleurs, typographies, thème du template INTOUCHABLES.** Aucun hex arbitraire, aucune nouvelle police. Ta créativité = la **composition** : dispositions, composants riches, hiérarchie, micro-détails, états. Les tokens `--chart-1` à `--chart-5` font partie du template : c'est TA palette pour différencier domaines/catégories (gradients, pastilles, fonds de cartes).
2. **Chaque page a sa signature visuelle propre** — pas deux pages qui se ressemblent — mais UN seul langage graphique global (principe P6 du projet). Exemple de signature : le catalogue = cartes à fond coloré ; le dashboard = stat cards + activité ; les résultats = dashboard analytique ; l'admin = tables denses efficaces.
3. **Données réelles uniquement** (principe P1 du projet) : jamais de chiffres inventés, de photos stock ou d'images externes. Pour habiller les cartes : **gradients et motifs SVG locaux** construits sur les tokens (ex. gradient `chart-2` pour le domaine santé), icônes lucide, initiales. Rien qui simule un contenu qui n'existe pas.
4. **i18n stricte** : tout nouveau texte va dans `messages/fr.json` ET `messages/en.json` (un test vitest impose la parité des clés). Aucune chaîne en dur dans le JSX.
5. **Le e2e mission doit rester vert.** LIS `apps/web/e2e/mission.spec.ts` AVANT de toucher une page du parcours (register → onboarding → projets → wizard → résultats → XAI → chat) : les sélecteurs sont des **libellés i18n** (boutons, titres) — si tu changes une clé ou déplaces un rôle ARIA, adapte le spec en conséquence, jamais en l'affaiblissant.
6. **Zéro régression fonctionnelle** : tu réorganises l'affichage, tu ne changes ni la logique, ni les appels API, ni les routes. Le client API généré est la seule source de données.
7. **Dark mode automatique** : si tu n'utilises que des tokens, il suit tout seul — vérifie chaque page dans les deux thèmes (toggle dans le header de l'app).

## Méthode imposée : subagents d'analyse, puis implémentation par lots

**Phase 1 — Analyse en parallèle.** Lance **un subagent par page** (liste ci-dessous, lance-les par vagues en parallèle). Chaque subagent doit :
- lire la page v2 actuelle (`apps/web/app/...` + composants `apps/web/components/ibis/...`) ;
- fouiller la page v1 équivalente (chemins ci-dessus) et décrire sa disposition ;
- fouiller **2 à 3 démos du template** pertinentes et identifier les patterns précis à réutiliser (chemins de fichiers exacts) ;
- rendre une **proposition structurée** : disposition cible (wireframe ASCII), composants du template à reprendre (fichiers), signature visuelle de la page, nouvelles clés i18n, risques (e2e, parité i18n).

**Phase 2 — Synthèse.** Toi, l'orchestrateur : relis les 14 propositions, élimine les doublons de signatures (deux pages qui auraient choisi le même pattern), garantis la cohérence du langage global, arbitre.

**Phase 3 — Implémentation par lots** de 2-3 pages maximum. Après CHAQUE lot :
```bash
cd apps/web && pnpm typecheck && pnpm lint && pnpm test && pnpm build
npx playwright test        # si une page du parcours mission est touchée
```
- vérification navigateur réelle (clair + sombre, desktop + mobile) avec captures ;
- un commit par lot, message `style: refonte <pages> — <signature>`.

## Les 14 surfaces, avec pistes de départ (le subagent approfondit, il ne s'y limite pas)

1. **`/` (landing)** — v1 : `ml-pipeline/landing` + `home`. Piste : hero qui montre le vrai produit (aperçu du wizard ou d'une explication), sections parcours mission.
2. **`/login` `/register` `/forgot-password` `/reset-password`** — v1 : `authentication/`. Template : layouts d'auth des démos. Piste : split-screen avec panneau de marque (gradient tokens + promesse produit), formulaires aérés.
3. **`/onboarding`** — piste : cartes de choix incarnées (icônes, descriptions), progression visible, ton chaleureux.
4. **`/dashboard`** — v1 : `ml-pipeline-dashboard`, `analytics`. Template : `default`, `ecommerce`, `website-analytics`. Piste : stat cards du kit avec icônes et tendances, activité récente en timeline (`components/ui/timeline`), carte « reprendre mon brouillon » mise en avant.
5. **`/datasets` (catalogue)** — ⭐ demande explicite d'Anthony : **cartes avec fond coloré/gradient par domaine** (mapper chaque domaine sur un token chart-1..5), motif décoratif local, badges éthique/qualité lisibles, hover riche, toggle grille/liste. v1 : `datasets/dataset-listing`. Template : produits `ecommerce`, annonces `real-estate`, cartes `file-manager`.
6. **`/datasets/[id]` (détail)** — v1 : `datasets/dataset-detail` (4 onglets — reprends cette structure). Template : détails `real-estate`/`hotel`. Piste : bandeau d'en-tête au gradient du domaine + stats clés, onglets travaillés, critères éthiques en grille visuelle tristate.
7. **`/datasets/upload` + `/datasets/[id]/complete`** — ⭐ « les formulaires pourraient être plus sympas » : sections avec icônes et titres, aperçu live du fichier analysé, stepper visuel, zone de drop soignée. Template : `pages/settings`, formulaires des démos.
8. **`/datasets/score` (heatmap)** — piste : mise en scène de la heatmap (légende, sticky headers), panneau de pondérations en side-panel agréable.
9. **`/projects` + `/projects/new|edit` + `/projects/[id]`** — v1 : `projects/project-detail`. Template : `project-list`, `crm`. Piste : cartes projet avec progression de mission (Projet → Dataset → Entraînement → Explication), formulaire 3 étapes plus visuel avec aperçu live des recommandations valorisé.
10. **`/experiments` + `/experiments/[id]`** — v1 : `experiments-list` et surtout **`experiment-results` (fouille-le sérieusement, c'était la page la plus riche de la v1)**. Template : `analytics`, `widgets`. Piste : résultats en dashboard analytique (KPI cards, graphes Recharts déjà présents mais mieux mis en scène), onglet Explicabilité aéré (KPI de fiabilité en tuiles, chat plus incarné).
11. **`/profile`** — template : `pages/profile`, `pages/settings`. Piste : en-tête identité + sections par onglets.
12. **`/status`** — piste : cartes de services avec états vivants, démo SSE en timeline.
13. **`/admin/users|datasets|ethical-templates|jobs`** — template : `pages/users` et les tables riches des démos. Piste : garder la densité (c'est de l'admin) mais soigner en-têtes, filtres, états vides.
14. **`404` / `error`** — un petit moment de marque (illustration SVG locale aux tokens), jamais un cul-de-sac.

## Definition of done

- Les 14 surfaces refondues ; **aucune ne ressemble à une autre** ; langage graphique unique conservé ; niveau ≥ wizard actuel.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` verts ; **e2e mission FR + EN verts** (`npx playwright test`) ; captures clair + sombre par page.
- Aucun token modifié, aucun texte hors i18n, aucun fetch manuel, backend intact, routes démo du template non réintroduites dans `apps/web/app/`.
- Commits par lots, messages clairs. À la fin : un récapitulatif par page (signature choisie + sources v1/template utilisées).
