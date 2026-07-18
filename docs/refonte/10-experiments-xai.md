# 10 — Expériences `/experiments` + `/experiments/[id]` (résultats + explicabilité + chat)

## Signature visuelle (1 phrase forte + mots-clés)

**Un studio analytique de résultats** : score composite en médaillon-gradient tonal, tuiles de métriques à indicateur (dot + barre), heatmap de confusion soignée, onglet Explicabilité aéré en tuiles de fiabilité + graphes lisibles + chat incarné (bulles, avatar, loader de frappe). Distinct du **cockpit** du dashboard (`app/(app)/dashboard/page.tsx`, tuiles icône+chiffre plates) : ici on est dans l'**analyse post-entraînement**, plus dense, plus « labo ».

Mots-clés : *médaillon de score · tuiles à barre de performance · heatmap tonale · chat incarné · pills de contexte*.

## Disposition cible (wireframe ASCII)

### `/experiments` — liste (tableau + bandeau stats réel)

```
┌────────────────────────────────────────────────────────────────────┐
│ Expériences                                                        │
│ Toutes vos expériences, tous projets confondus…                    │
│ ┌───────────┬───────────┬───────────┐   (StatCards-like, 3 tuiles) │
│ │ N total   │ N terminées│ Score moy.│   ← calculés depuis `items` │
│ └───────────┴───────────┴───────────┘     réels (pas de fetch de+) │
│ [Statut ▾]  [Algorithme ▾]                                         │
├────────────────────────────────────────────────────────────────────┤
│ Dataset │ Algo (icône) │ Statut (● pulse si running) │ Score │ ⏱ │▸│
│ …                                                                   │
└────────────────────────────────────────────────────────────────────┘
```

### `/experiments/[id]` — résultats (onglet Performance)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Projet → Dataset → Entraînement → Explication   (MissionStepper)     │
│ Résultats de l'expérience                     [↺ Relancer][⬇ Modèle] │
│ ⦿ decision_tree   ⦿ classification   ⦿ 3 classes   ⦿ 12s             │  ← pills contexte réelles
├──────────────────[ Performance ]──[ Explicabilité ]───────────────────┤
│ ┌─────────────────────────────┐  ┌───────────────────────────────┐   │
│ │  MÉDAILLON SCORE (gradient)  │  │ Métrique principale (grande)  │   │
│ │   anneau conique + %         │  │ + 2-3 sous-métriques compactes│   │
│ │   label qualitatif           │  └───────────────────────────────┘   │
│ └─────────────────────────────┘                                      │
│ ┌────────┬────────┬────────┬────────┐  (tuiles métriques restantes,  │
│ │ metric │ metric │ metric │ metric │   dot couleur + barre + hint)  │
│ └────────┴────────┴────────┴────────┘                                │
│ ┌───────────────────────┐ ┌───────────────────────┐                  │
│ │ Matrice de confusion  │ │ ROC / PR / Importance │  (grille 2 col)  │
│ │  (heatmap tonale)     │ │  (Recharts existants)  │                  │
│ └───────────────────────┘ └───────────────────────┘                  │
│ [Transformations appliquées]   [Journal d'entraînement]  (Item list) │
└────────────────────────────────────────────────────────────────────┘
```

### Onglet Explicabilité (`xai.*`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Demander une explication (carte)                                     │
│  [ Globale ]  [ Locale ]     Méthode: (Auto)(SHAP)(LIME)              │
│  [instance table si locale]                                          │
│  [✨ xai.request.launch]  Coût: 1 crédit         ▓▓▓▓░░ progress      │
├──────────────────────────────────────────────────────────────────────┤
│ Fiabilité de l'explication (xai.kpis.title)                          │
│ ┌────────┬────────┬────────┬────────┬────────┬────────┐             │
│ │Complét.│Stabilité│Fidélité│Accord │Parcimon│Temps  │  ← 6 tuiles   │
│ │ ✓ dot  │ ✓ dot   │ ✓ dot  │ ✓ dot │  info  │  info │    tonales,  │
│ └────────┴────────┴────────┴────────┴────────┴────────┘   pas juste │
│                                                              bordées  │
│ ┌───────────────────────────┐  ┌───────────────────────────┐        │
│ │ Importance globale (SHAP) │  │ Contributions (waterfall) │        │
│ └───────────────────────────┘  └───────────────────────────┘        │
│ [Texte explication encadré, typo aérée, icône]                       │
├──────────────────────────────────────────────────────────────────────┤
│ Discuter de cette explication          [avatar IA] [avatar user]     │
│  bulle assistant (bg-muted, avatar rond) ────────                    │
│           ──────── bulle user (bg-primary, avatar initiales)         │
│  [•••] xai.chat.waiting (TypingLoader)                                │
│  [Votre question…] [➤ envoyer]                                       │
└──────────────────────────────────────────────────────────────────────┘
```

## Blocs template à reprendre (fichier exact → quoi en extraire)

1. **`shadcn-ui-kit-dashboard-main/.../app/dashboard/(auth)/crypto/components/overview-card.tsx`** (lignes 9-24) — le panneau **gradient enveloppant** `bg-gradient-to-r from-chart-1/40 to-chart-2/60` + carte interne `bg-background rounded-lg p-4` : à reprendre pour le **médaillon de score composite** de l'onglet Performance (remplace l'actuel `Card` simple avec juste l'anneau conique). Adapter en tokens neutres (voir §Palette).
2. **`.../website-analytics/components/tickets-card.tsx`** (lignes 36-73, le `PieChart` avec `Label` centré `88% / Completed`) — pattern du **texte centré dans un donut Recharts** ; utile en variante pour le futur, mais on garde le `conic-gradient` CSS déjà existant (plus léger, pas de dépendance Recharts pour un simple anneau) — juste reprendre la mise en scène (médaillon + texte qualitatif à côté, footer à 3 items avec icône ronde bordée, lignes 75-103) pour le nouveau bloc composite.
3. **`.../crypto/components/overview-card.tsx`** encore : le sous-bloc lignes 14-24 (deux stats côte à côte, une en avant, une dans un encart `bg-muted rounded-xl`) — pattern pour juxtaposer **médaillon composite** + **métrique principale mise en avant**.
4. **`.../website-analytics/components/stat-cards.tsx`** (lignes 39-67) — la **tuile KPI avec `Badge` de tendance** (`inline-flex items-center px-1.5 py-0.5`, icône `TrendingUp/TrendingDown`) : à adapter (sans invention de tendance, on n'a pas d'historique) pour les **tuiles de métriques restantes** de l'onglet Performance — remplacer le badge de tendance par un **badge/dot de statut qualitatif** (bon/moyen/faible) déjà calculable depuis la valeur de la métrique.
5. **`.../crypto/components/recent-activities.tsx`** (lignes 72-101) — le pattern **icône ronde bordée (`size-12 rounded-full border`) + libellé + horodatage + valeur alignée à droite** : à reprendre pour la liste **Historique** de l'onglet XAI (actuellement une simple ligne flex) et pour le **journal d'entraînement** (remplace le `<ul>` `font-mono` brut par des lignes `Item`).
6. **`.../crypto/components/digital-wallets.tsx`** (lignes 21-33) — carte-lien `hover:border-primary/30 hover:bg-muted rounded-md border px-4 py-3` : pattern pour les **entrées cliquables de l'historique XAI** (`t("history.view")`).
7. **`.../app/dashboard/(auth)/apps/ai-chat/app-render.tsx`** (lignes 152-193) — la mise en scène **Message / MessageContent / avatar / bulle assistant vs user**, alignement `justify-end` pour l'utilisateur, `bg-muted … prose rounded-lg border` pour l'assistant, `bg-primary text-primary-foreground` pour l'utilisateur : à adapter dans `XaiChat` (actuellement des `div` inline sans avatar). Ne PAS copier le composeur `PromptInput*` complet (trop riche/hors scope) — juste le rendu des bulles + le loader d'attente (`PromptLoader variant="typing"` ligne 189-193 du fichier source, `.../components/ui/custom/prompt/loader.tsx` lignes 179-212 pour `TypingLoader`).
8. **`.../website-analytics/components/total-earning-card.tsx`** (lignes 92-113) — pattern **ligne d'info avec icône dans pastille `bg-muted rounded-md border size-10`** : à reprendre pour les **pills de contexte** du header résultats (algorithme / type de tâche / classes / durée), en remplaçant les `Badge` plats actuels.
9. **v1 `experiment-results.component.html`** (lignes 10-46, `compact-header` + `context-pills`) — disposition **header compact avec pills de contexte** (algorithme, type de tâche, score/qualité) sous le titre : à reprendre en pills tonales réelles (pas de couleur vive, `border` + icône lucide + `chart-N/10`).
10. **v1 `experiment-results.component.html`** (lignes 154-192, `metrics-grid` / `metric-card`) — disposition **tuile métrique avec header icône+indicateur, valeur, nom, barre de progression** : base directe pour les tuiles de métriques (point 4 ci-dessus l'habille avec le badge template).
11. **v1 `experiments-list.component.html`** (lignes 25-38, `hero-stats`) — bandeau de **3 statistiques calculées côté client** (complétées, perf. moyenne, taux de succès) au-dessus du tableau de `/experiments` — objectif : mêmes stats mais calculées depuis `items` déjà chargés (aucun nouvel appel API), présentées en tuiles sobres façon `stat-cards.tsx` (point 4).

## Composants ibis à créer / modifier (chemins)

- `apps/web/components/ibis/experiments/result-charts.tsx` : ajouter un composant **`CompositeScoreCard`** (nouveau) qui reprend l'actuel bloc inline de `ExperimentResultsPage` (lignes 145-167) — médaillon gradient + métrique principale mise en avant (bloc template #1/#3). Garder le calcul `conic-gradient` existant (données réelles `composite.value/label/method`).
- `apps/web/components/ibis/experiments/result-charts.tsx` : nouveau **`MetricTile`** remplaçant la `Card` brute du `.map` de métriques (page `[id]`, lignes 172-196) — dot tonal + barre de progression + hint en `title` existant, badge `metrics.primary` conservé.
- `apps/web/components/ibis/experiments/result-charts.tsx` : `ConfusionMatrix` — garder la logique, seulement resserrer les cellules (déjà correct, juste vérifier contraste dark).
- `apps/web/app/(app)/experiments/[id]/page.tsx` : remplacer le `<div className="flex flex-wrap items-start justify-between">` (lignes 114-135) par header + **pills de contexte** (bloc #8/#9) utilisant `results?.algorithm`, `results?.task_type`, `results?.class_names?.length`, `experiment.duration_seconds`, `composite.label` — toutes réelles.
- `apps/web/app/(app)/experiments/[id]/page.tsx` : remplacer `<ul>` du journal (lignes 255-261) par `Item`/`ItemGroup` (`apps/web/components/ui/item.tsx`) — icône `TerminalIcon`/`InfoIcon` selon contenu, horodatage en `ItemContent`/`ItemDescription`.
- `apps/web/app/(app)/experiments/page.tsx` : ajouter un bandeau de **3 tuiles stats client-side** (total, terminées, score moyen — calculées depuis `items`, jamais un nouvel endpoint) avant les filtres, réutilisant le pattern `stat-cards.tsx` (nouveau petit composant local `ExperimentsStatBand` ou inline).
- `apps/web/components/ibis/xai/explanation-view.tsx` : `KpiTile`/`KpiBoard` (lignes 14-113) — passer de `rounded-md border p-3` brut à variante inspirée `stat-cards.tsx` (dot + `Badge` qualitatif au lieu de texte coloré nu), grille `sm:grid-cols-3 lg:grid-cols-6` pour aérer (6 indicateurs possibles).
- `apps/web/components/ibis/xai/xai-tab.tsx` : historique (lignes 252-279) — remplacer la ligne flex par `Item`/`ItemMedia`/`ItemContent` (bloc #5/#6), et l'état vide par `Empty`/`EmptyMedia`/`EmptyTitle` (`apps/web/components/ui/empty.tsx`) au lieu du simple `<p>`.
- `apps/web/components/ibis/xai/xai-chat.tsx` : refonte des bulles (lignes 134-149) en `Message`/`MessageAvatar`/`MessageContent` (`apps/web/components/ui/custom/prompt/message.tsx`, DÉJÀ présent dans `apps/web`) — avatar assistant = monogramme `IA`/icône `SparklesIcon` sur fond `chart-1/15`, avatar user = `useAvatarUrl()` + `userInitials()` (`apps/web/components/ibis/use-avatar.ts`, déjà utilisés ailleurs dans le projet — vérifier import existant type profil). État d'attente (ligne 148) → `PromptLoader variant="typing"` (primitive à copier, voir §Primitives manquantes) **à la place du texte `xai.chat.waiting` nu, mais le texte `xai.chat.waiting` DOIT rester présent et visible pour l'e2e** (ex. `<TypingLoader/><span>{t("waiting")}</span>` — les deux coexistent, ne pas remplacer le texte par l'icône seule).
- `apps/web/components/ibis/xai/xai-chat.tsx` : carte de démarrage (lignes 89-100) — enrichir avec une icône dans pastille tonale (`SparklesIcon` sur `bg-chart-1/10`), garder le bouton `xai.chat.start` intact.

## Palette tonale & motifs (mapping chart-1..5 / patterns SVG, en monochrome)

- **Médaillon composite** : `conic-gradient(var(--primary) …, var(--muted) …)` conservé (déjà tonal) ; l'enveloppe externe façon `overview-card` passe en `bg-gradient-to-br from-primary/8 to-chart-2/15` (jamais de hex).
- **Tuiles métriques (Performance)** : dot de statut avec `bg-chart-1` (bon), `bg-chart-3` (moyen), `bg-chart-4`/`border-destructive/60` (faible) — pas de vert/rouge vifs custom, on reste sur les nuances neutres déjà définies par le thème `default` (chart-1..5 = nuances de base). Si le thème n'est pas `default`, ces mêmes tokens deviennent teintés automatiquement — ne pas figer de couleur.
- **KPI XAI (fiabilité)** : garder les classes `text-green-600 dark:text-green-400` etc. de `KpiTile` **uniquement si le thème actif est `default`** n'est pas garanti — en toute rigueur ces couleurs sémantiques (vérifié/non vérifié) sont déjà utilisées ailleurs dans l'app (ex. wizard, badges destructive) donc **tolérées** comme signal sémantique fort (succès/échec d'un axiome), à ne pas retirer — seulement encadrer dans une tuile avec dot assorti au lieu de texte coloré seul (meilleure accessibilité).
- **Chat XAI** : avatar assistant = fond `chart-1/15` + icône `SparklesIcon` (motif = icône, pas de nouvelle couleur) ; avatar utilisateur = image réelle (`useAvatarUrl`) ou initiales sur `bg-muted`.
- **Matrice de confusion** : déjà tonale (`hsl(var(--chart-1)/opacity)`), garder tel quel — c'est déjà le bon pattern « nuance = intensité ».
- **Motif SVG local** : aucun nouveau motif de fond nécessaire ici (surface dense en données réelles, pas de zone vide à habiller) — seule l'`Empty` de l'historique XAI utilise l'icône `EmptyMedia variant="icon"` déjà tonale (`bg-muted`).

## Données réelles utilisées (champs du client généré)

- `ExperimentSummary` (`/experiments` liste + onglet projet) : `dataset_name`, `algorithm`, `status`, `progress`, `primary_metric_name`, `primary_metric_value`, `duration_seconds`, `created_at` — la bande de stats du haut se calcule à partir de ces items déjà chargés (`items.filter(status==='completed').length`, moyenne de `primary_metric_value` quand présent).
- `ExperimentResults` (`/experiments/[id]`) : `algorithm`, `task_type`, `class_names` (→ nombre de classes pour la pill), `composite.{value,label,method}`, `metrics` (dict dynamique via `METRIC_ORDER`), `viz_data.{confusion_matrix, roc_curve, pr_curve, feature_importance, tree_structure, predicted_vs_actual, residuals, residuals_histogram}`, `applied_preprocessing.steps`.
- `ExperimentWithQueue` : `duration_seconds`, `project_id`, `dataset_id` (lien relance).
- `LogLine[]` : `ts`, `message` (journal).
- `ExplanationResults` : `method_used`, `is_fallback`, `model_used`, `audience_level`, `method_justification`, `quality_kpis.{shap_completeness, stability, lime_fidelity, inter_method_agreement, parsimony, computation_seconds}`, `viz_data.{global_importance, waterfall, method_comparison}`, `values.{base_value, prediction, predicted_label}`, `text_explanation`.
- `ExplanationRead[]` (historique) : `type`, `method_used`, `status`, `is_fallback`, `created_at`.
- `ChatSessionRead`/`ChatMessageRead` : `max_questions`, `questions_count`, `is_active`, `role`, `content`, `is_fallback`.

Aucun champ nouveau requis côté backend — tout ce qui précède existe déjà dans `apps/web/lib/api/generated/types.gen.ts`.

## Nouvelles clés i18n (liste fr — l'implémenteur fera en)

Sous `experimentsPage.stats.*` (bandeau `/experiments`) :
- `experimentsPage.stats.total` : "Expériences"
- `experimentsPage.stats.completed` : "Terminées"
- `experimentsPage.stats.avgScore` : "Score moyen"
- `experimentsPage.stats.noData` : "—"

Sous `experiments.*` :
- `experiments.contextPills.classes` : "{count} classes"
- `experiments.contextPills.algorithm` déjà couvert par `results.algorithm` brut (pas de clé, valeur dynamique) — pas de nouvelle clé nécessaire si on affiche la valeur brute comme aujourd'hui.
- `experiments.metricQuality.good` / `.medium` / `.low` (labels qualitatifs de la barre de progression des tuiles métriques, si on va au-delà des tons déjà en `experiments.composite.*`).

Sous `xai.kpis.*` : aucune nouvelle clé — toutes déjà présentes (`title`, `hint`, `completeness…`, `labels.*`).

Sous `xai.chat.*` : aucune nouvelle clé texte — seulement un usage supplémentaire du `waiting` existant à côté du loader animé.

Total estimé : **~6 à 8 nouvelles clés** (fr + en), toutes de présentation, aucune ne touche aux clés protégées par l'e2e.

## Risques (e2e, parité i18n, perfs) + parades

- **Risque majeur (à éviter absolument)** : dans `XaiChat`, ne pas supprimer le texte `xai.chat.waiting` au profit d'un loader visuel seul — le test `expect(page.getByText(t(m, "xai.chat.waiting"))).toBeHidden(...)` exige que ce **texte** existe puis disparaisse. Parade : toujours rendre `<span>{t("waiting")}</span>` à côté de `TypingLoader`, jamais à sa place.
- **Risque** : le titre `xai.charts.importance` est testé via `t(m, "xai.charts.importance").split(" (")[0]` puis `getByText(RegExp)` — si on renomme/déplace ce `CardTitle`, le motif regex doit rester en tête de chaîne visible. Parade : ne pas toucher `explanation-view.tsx` ligne 156-158 (le `CardTitle` du graphe SHAP), seulement son environnement (grille, largeur).
- **Risque** : l'onglet `role=tab` `experiments.tabXai` doit rester un vrai `TabsTrigger` — ne pas le transformer en simple bouton stylé. Parade : garder `Tabs`/`TabsList`/`TabsTrigger` de shadcn tel quel, seulement styliser autour.
- **Risque** : `xai.request.launch` est cliqué directement dans le test **sans changer type/méthode** — donc les valeurs par défaut (`type="global"`, `method="auto"`) doivent rester les valeurs initiales des `useState`. Parade : ne pas modifier les défauts de `xai-tab.tsx` lignes 42-43 en réorganisant la carte de sélection.
- **Risque i18n** : toute nouvelle clé doit être ajoutée en fr ET en (test vitest de parité) — lister les clés ci-dessus dans les deux fichiers `messages/fr.json` / `messages/en.json`.
- **Risque perf** : le polling 5 s de `/experiments` (liste) et `project-experiments-tab` reste inchangé ; le nouveau bandeau de stats se calcule en mémoire sur `items` déjà en state, donc **zéro appel réseau supplémentaire**.
- **Risque perf mineur** : ajouter `Message`/`MessageAvatar` par message dans `XaiChat` charge `useAvatarUrl()` (blob + `URL.createObjectURL`) — s'assurer qu'un seul hook est monté au niveau du composant parent (pas par message) et que l'avatar assistant n'appelle jamais cet endpoint (icône statique).

## Primitives ui manquantes à copier depuis la source template

- `apps/web/components/ui/custom/prompt/loader.tsx` — **absent** de `apps/web` (seul `message.tsx` y est déjà). Copier depuis `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/components/ui/custom/prompt/loader.tsx` (fichier complet, ~445 lignes, plusieurs variantes — n'utiliser que `TypingLoader`/`PromptLoader variant="typing"` pour l'attente du chat XAI, ou `DotsLoader` en repli plus sobre). Aucune dépendance externe supplémentaire (pur Tailwind + `cn`).
- Le reste (`Message`, `MessageAvatar`, `MessageContent`, `Avatar`, `Item*`, `Empty*`, `Badge`, `Progress`) est **déjà présent** dans `apps/web/components/ui/*` — aucune autre copie nécessaire.
