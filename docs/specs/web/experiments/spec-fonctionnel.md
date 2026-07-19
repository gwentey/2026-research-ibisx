# Spec Fonctionnelle — web/experiments [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | web/experiments     |
| Version    | 0.1.0               |
| Date       | 2026-07-19          |
| Auteur     | retro-documenter    |
| Statut     | DRAFT               |
| Source     | Rétro-ingénierie    |

> **[DRAFT — à valider par le dev]** Cette spec a été générée par rétro-ingénierie
> à partir du code existant. Elle doit être relue et validée par un développeur
> qui connaît le contexte métier.

---

## ADRs

| # | Titre | Catégorie | Statut |
|---|-------|-----------|--------|
| [RETRO-020](../../../adr/RETRO-020.md) | Révélation progressive des blocs de résultats par niveau d'audience | DESIGN | Documenté (rétro) |

---

## Contexte et objectif

La page `experiments/[id]` est la surface de consultation des résultats d'une expérience ML terminée. Elle agrège et présente en un seul écran : les métriques de performance du modèle entraîné, les visualisations de classification ou régression, l'explication post-hoc (XAI via SHAP/LIME), l'analyse d'équité (fairness par attribut sensible), et les lectures disciplinaires (regards métier, 6 disciplines SHS).

L'objectif central est de rendre les résultats lisibles par des utilisateurs de niveaux très différents — novice, intermédiaire, expert — sans leur retirer l'accès à des informations plus avancées. La feature sert également de point d'arrivée du parcours de mission (MissionStepper) et de débrief des défis guidés (ChallengeDebrief).

---

## Règles métier (déduites du code)

1. **Révélation progressive (P1)** — les blocs de résultats ont chacun un niveau minimum requis (`BLOCK_MIN_AUDIENCE`). Un bloc sous le seuil est replié dans un accordéon « Détails avancés » mais jamais supprimé. Le novice peut déplier.

2. **Niveau effectif éphémère** — le niveau affiché par défaut est celui du profil utilisateur (`xai_audience`), mais il peut être surchargé par le sélecteur « Voir en tant que » sans modifier le profil. La surcharge est locale à la page (réinitialisée à chaque ouverture).

3. **Niveau effectif propagé au backend** — lorsque l'utilisateur demande une explication XAI, le niveau effectif (pas le profil) est transmis dans le corps de la requête. L'explication (profondeur du texte LLM, ton du copilote) s'adapte au niveau affiché, pas au profil stocké.

4. **Vue novice simplifiée** — en niveau novice, l'onglet Performance n'affiche que la métrique principale (une tuile) en ligne directe ; la grille complète tombe dans « Détails avancés ». Un message de contextualisation est également affiché.

5. **Score composite** — si `results.composite` est présent, un médaillon de score composite (valeur 0–100, méthode) est affiché avant les métriques individuelles, quel que soit le niveau.

6. **Regard métier** — le composant `LensSwitcher` est orthogonal au niveau d'audience : il bascule le cadrage interprétatif (économiste, juriste, sociologue, historien, politiste, éthicien, ou aucun) sans modifier les chiffres réels. Le regard actif est initialisé depuis la préférence stockée en localStorage, puis surchargeable localement.

7. **ChallengeDebrief conditionnel** — l'encart de débrief de défi s'affiche uniquement si : un défi est actif (Zustand), l'expérience est terminée (`status === "completed"`), et le dataset de l'expérience correspond au dataset du défi (vérifié par `resolveDatasetId`). Il coche automatiquement les objectifs `read_results` (à l'affichage) et `generate_explanation` (dès qu'une explication complète existe).

8. **Téléchargement du modèle** — le bouton « Télécharger » déclenche `downloadModel`, crée un blob et provoque un téléchargement navigateur nommé `ibisx-model-{id}.joblib`. Disponible indépendamment du niveau.

9. **Re-lancement** — le bouton « Re-lancer » renvoie vers `/wizard?projectId=…&datasetId=…` avec les identifiants de l'expérience courante.

10. **Comparaison d'expériences (ProjectExperimentsTab)** — depuis la vue projet, l'utilisateur peut sélectionner jusqu'à 8 expériences terminées et les comparer côte-à-côte dans une modale (tableau + graphique barres multi-séries). Les expériences en cours de traitement peuvent être sélectionnées uniquement quand elles ont le statut `completed`. Les statuts courants sont rafraîchis par polling toutes les 5 secondes.

---

## Cas d'usage (déduits)

### CU-001 — Consulter les résultats d'une expérience terminée

L'utilisateur clique sur une expérience terminée depuis la liste de son projet. La page charge en parallèle les données de l'expérience, ses résultats et ses logs. L'onglet Performance est actif par défaut. Le niveau de l'utilisateur détermine les blocs visibles directement.

### CU-002 — Explorer les résultats à un autre niveau

L'utilisateur bascule le sélecteur « Voir en tant que » sur un niveau différent du sien. Un garde-fou contextuel l'avertit si son niveau effectif est au-dessus de son profil (ton alerte) ou en dessous (ton informatif). Les blocs visibles se recalculent immédiatement. Un bouton « Revenir à mon niveau » réinitialise.

### CU-003 — Lire l'explication XAI

L'utilisateur clique sur l'onglet « Explicabilité ». Il choisit le type (vue d'ensemble / exemple précis) et la méthode (auto / SHAP / LIME). Si local, il sélectionne une instance de test. Il clique « Lancer ». Un panneau de génération avec étapes animées montre la progression via SSE. L'explication s'affiche avec révélation IA (animation) une fois terminée. Le niveau effectif courant est utilisé pour la génération.

### CU-004 — Analyser l'équité

L'utilisateur clique sur l'onglet « Équité ». Il sélectionne un attribut sensible. `FairnessPanel` affiche les métriques par groupe (taux de sélection, TVP, exactitude, ratios de disparité). `CausalCaveat` affiche le garde-fou de causalité sur l'importance des variables.

### CU-005 — Changer le regard disciplinaire

L'utilisateur clique sur un regard dans `LensSwitcher` (économiste, juriste, etc.). Un encart `LensReading` s'affiche au-dessus des onglets, reformulant les résultats selon la grille de lecture de la discipline. Les métriques affichées sont les mêmes ; seul l'angle interprétatif change.

### CU-006 — Comparer plusieurs expériences d'un projet

Depuis la page projet, l'utilisateur coche 2 à 8 expériences terminées et clique « Comparer ». Une modale s'ouvre avec un tableau des métriques clés et un graphique en barres groupées par algorithme × dataset.

### CU-007 — Progresser dans un défi guidé

Un utilisateur en défi actif arrive sur les résultats d'une expérience appartenant à son défi. L'encart `ChallengeDebrief` s'affiche avec la métrique principale réelle, un récapitulatif pédagogique, et le CTA vers l'étape suivante ou le prochain défi.

---

## Dépendances

- **api/experiments** — `getExperiment`, `getExperimentResults`, `getExperimentLogs`, `downloadModel`, `listProjectExperiments`, `deleteExperiment`, `compareExperiments`
- **api/xai** — `requestExplanation`, `listExplanations`, `getExplanationResults`, `listTestInstances`
- **api/jobs** — SSE `GET /jobs/{id}/events` pour la progression de la génération d'explication
- **web/xai** — `XaiTab`, `ExplanationCopilot`, `ExplanationView` (composants du copilote et de l'affichage d'explication)
- **web/fairness** — `FairnessPanel`, `CausalCaveat`
- **web/lenses** — `LensSwitcher`, `LensReading`, `useLensStore`, `extractInsights`
- **web/challenges** — `ChallengeDebrief`, `useQuestStore`, `resolveDatasetId`, `nextObjective`
- **lib/audience/policy** — `BLOCK_MIN_AUDIENCE`, `isBlockVisible`, `compareAudience` (politique de révélation progressive)
- **lib/auth/store** — `useAuthStore` pour `xai_audience` du profil et rechargement du solde de crédits

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- Le cahier des charges adaptatif (`docs/adaptatif/CAHIER-DES-CHARGES.md`) est référencé dans les commentaires (§4, §5.1, §6) mais n'a pas été lu pendant la rétro : valider que les règles de `BLOCK_MIN_AUDIENCE` correspondent exactement au document source.
- La valeur maximale de 8 expériences comparables simultanément est imposée dans le code sans commentaire explicatif — vérifier s'il s'agit d'une contrainte UX, technique (backend), ou arbitraire.
- Le système de crédits (rechargement après génération XAI via `getMe`) est visible dans `xai-tab.tsx` mais non documenté ici — clarifier si le coût par explication est fixe ou variable.
- `AudienceWarning` n'a pas de test dédié côté Vitest — valider si la couverture est jugée suffisante par les tests e2e Playwright.
