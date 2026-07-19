# Dette Technique — IBIS-X v2

> Classement par criticité : CRITIQUE > MAJEUR > MINEUR
> Source : audit du code réel (2026-07-19)

---

## CRITIQUE — À corriger immédiatement

*Ces items créent des risques de régression silencieuse ou de comportement incorrect en production.*

| # | Description | Feature | Fichier(s) | Impact |
|---|------------|---------|-----------|--------|
| C1 | **Module `api/llm` sans aucun test** : `client.py`, `xai_text.py`, `guides.py` — 0 fichier de test. Les prompts adaptatifs, la validation anti-hallucination (`numbers_exist_in_context`), et les fallbacks déterministes sont non couverts. | api/llm | `apps/api/ibis/modules/llm/` (3 fichiers) | Régression sur la génération XAI non détectable avant prod ; le LLM est le point de défaillance externe le plus probable |
| C2 | **`viz_data` non validé par un schéma Pydantic** : `evaluation.py` produit un dict Python non typé stocké en JSONB. Si un champ est renommé (`confusion_matrix` → `confusionMatrix`), `result-charts.tsx` rend silencieusement des graphiques vides, sans erreur ni log. Documenté dans RETRO-010. | api/ml, web/experiments | `apps/api/ibis/modules/ml/evaluation.py`, `apps/web/components/ibis/experiments/result-charts.tsx` | Dégradation silencieuse de la page de résultats sans détection CI |
| C3 | **Tasks Celery `train_experiment` et `generate_explanation` sans tests unitaires directs** : seuls les tests d'intégration e2e les couvrent indirectement (run nightly). Les erreurs de refactoring dans `train.py` ou `explain.py` ne sont pas détectées avant le lendemain. | api/ml, api/xai | `apps/api/ibis/workers/tasks/train.py` (~187 lignes), `apps/api/ibis/workers/tasks/explain.py` (~327 lignes) | Pipeline ML/XAI cassé non détecté en PR, découvert seulement au e2e nightly |
| C4 | **Bug timezone dans le comptage des quotas journaliers** : `service.py` ligne 105 calcule `day_start = datetime.now(UTC).replace(..., tzinfo=None)`, produisant un datetime naïf comparé à des timestamps PostgreSQL UTC. Le quota journalier peut être mal calculé à minuit UTC ou pour des utilisateurs dans un fuseau différent de UTC. Documenté dans RETRO-008. | api/experiments | `apps/api/ibis/modules/experiments/service.py` ligne 105 | Utilisateurs débités de quotas incorrects ou autorisés au-delà de leur limite |
| C5 | **`resolveDatasetId` limité à 96 datasets sans pagination** : la résolution slug → UUID charge `page_size=96` et filtre localement. Si le catalogue dépasse 96 entrées, le dataset recherché n'est pas trouvé et `resolveDatasetId` retourne `null` silencieusement. La page de briefing affiche une erreur et bloque le lancement de la mission. Documenté dans la spec-technique web/challenges. | web/challenges | `apps/web/lib/challenges/resolve-dataset.ts` ligne 7 | Toutes les missions deviennent inutilisables au-delà de 96 datasets dans le catalogue |

---

## MAJEUR — À planifier dans les 2 prochains sprints

*Ces items créent des risques de régression, de désynchronisation de contrat ou de qualité insuffisante.*

| # | Description | Feature | Fichier(s) | Impact |
|---|------------|---------|-----------|--------|
| M1 | **`ethics.py` sans tests unitaires** : le calcul du score éthique (`ethical_score()`), le comportement tristate (`None ≠ False`), et le cas de liste vide sont non couverts. Signalé dans RETRO-003. | api/datasets | `apps/api/ibis/modules/datasets/ethics.py` (~28 lignes) | Score éthique potentiellement incorrect pour des datasets incomplets ; comportement tristate cassé sans détection |
| M2 | **`filters.py` sans tests unitaires** : 20+ critères de filtrage SQL composés (domaine, tâche, critères éthiques, bornes numériques, tri stable) non testés en isolation. | api/datasets | `apps/api/ibis/modules/datasets/filters.py` (~89 lignes) | Filtre SQL incorrect → résultats manquants ou aberrants dans le catalogue |
| M3 | **`importer.py` sans tests** : l'import YAML/Kaggle idempotent (seed dev) est non couvert. Régression possible sur le seeding qui alimente le e2e nightly. | api/datasets | `apps/api/ibis/modules/datasets/importer.py` (~143 lignes) | Échec silencieux du seed → e2e nightly cassé au prochain changement d'importer |
| M4 | **9 surfaces web sans aucun Vitest** : auth, onboarding, wizard (9 étapes + brouillon), datasets (state machine `useCatalog`), fairness, lenses (partiel), dashboard, admin. La complexité UX de ces surfaces (formulaires multi-étapes, state machines, gestion d'erreurs) est sans filet de test. | web/* | `apps/web/tests/` (dossiers manquants) | Régressions UI non détectées en PR ; dépendance exclusive aux tests e2e nightly |
| M5 | **`BlockDocument` Python/TypeScript synchronisé manuellement** : `blocks.py` (Pydantic) et `ibis-blocks.tsx`/`blocks.ts` (TypeScript) sont deux implémentations du même contrat. Toute évolution de type de bloc, champ requis ou discriminant doit être propagée manuellement dans 3 fichiers + les prompts LLM. Documenté dans RETRO-012. | api/xai, web/xai | `apps/api/ibis/modules/xai/blocks.py`, `apps/web/components/ibis/xai/ibis-blocks.tsx`, `apps/web/lib/xai/blocks.ts` | Désynchronisation silencieuse → type de bloc rendu invisible ou parser qui plante |
| M6 | **Pas de journal d'audit des mouvements de crédits** : seul le solde courant (`users.credits`) est visible. L'historique (débit, remboursement, attribution admin) n'est pas tracé. Documenté dans RETRO-008. | api/experiments, api/users | `apps/api/ibis/modules/experiments/service.py` (`enforce_quotas_and_debit`, `cancel_experiment`) | Impossible de reconstituer l'historique en cas de contestation ; migration vers facturation réelle bloquée |
| M7 | **`XaiAudience` enum défini dans `auth/models.py`, pas dans `xai/`** : un développeur cherchant la définition du niveau d'audience cherchera d'abord dans le module xai. Couplage conceptuel entre auth et xai. Signalé dans RETRO-002. | api/auth, api/xai | `apps/api/ibis/modules/auth/models.py` | Mauvais module de référence pour les évolutions du niveau d'audience ; couplage involontaire |
| M8 | **`ETHICAL_KEYS` frontend non validé en CI contre le backend** : la liste en `constants.ts` est le miroir de `ETHICAL_CRITERIA` dans `ethics.py`, mais aucun test de CI ne vérifie la synchronisation. Signalé dans RETRO-018. | api/datasets, web/datasets | `apps/web/lib/datasets/constants.ts`, `apps/api/ibis/modules/datasets/ethics.py` | 11ème critère côté backend → score UI calculé sur 10 critères ≠ score API sur 11 ; grille UI incomplète sans erreur |
| M9 | **`vocab.py` dans `ml/` importé depuis `datasets/profiling.py`** : dépendance inter-module transverse (datasets → ml). Signalé dans RETRO-011 comme dette à surveiller. | api/datasets, api/ml | `apps/api/ibis/modules/datasets/profiling.py` (import), `apps/api/ibis/modules/ml/vocab.py` | Couplage qui bloque l'extraction de datasets comme service indépendant |
| M10 | **`result-charts.tsx` (465 lignes) sans tests unitaires** : 8 composants de visualisation (ConfusionMatrix, RocCurve, PrCurve, ImportanceChart, TreeView, RegressionCharts, CompositeScoreCard, MetricTile) non testés. Signalé dans la spec-technique web/experiments. | web/experiments | `apps/web/components/ibis/experiments/result-charts.tsx` | Régressions visuelles non détectées sur la page de résultats principale |
| M11 | **`ChallengeDebrief` polling toutes les 4 s sans backoff exponentiel** : boucle de polling `setInterval(4000)` sur `listExplanations` pour détecter la fin d'une génération XAI. Pas de backoff, pas de limite de tentatives. | web/challenges | `apps/web/components/ibis/challenges/challenge-debrief.tsx` | Pression inutile sur l'API si la génération XAI prend plus de 2 minutes ; pas de protection contre un polling infini |
| M12 | **Sélection SHAP vs LIME par duck-typing non extensible** : `hasattr(model, "tree_") or hasattr(model, "estimators_")` est une heuristique qui ne fonctionnera pas pour un algorithme futur qui n'expose pas ces attributs. Documenté dans la spec-technique api/xai. | api/xai | `apps/api/ibis/modules/xai/engine.py` | L'ajout d'un nouvel algorithme (ex. SVM, gradient boosting) forcera KernelExplainer SHAP par défaut, potentiellement lent ou incorrectement configuré |

---

## MINEUR — À traiter en opportunité

*Améliorations de qualité, maintenabilité ou scalabilité sans impact immédiat.*

| # | Description | Feature | Fichier(s) | Impact |
|---|------------|---------|-----------|--------|
| N1 | **`BLOCK_MIN_AUDIENCE` sans mécanisme de rappel pour nouveaux blocs** : tout nouveau bloc de résultats omis de la table est visible pour tous (niveau novice par défaut). Signalé dans RETRO-020. | web/experiments | `apps/web/lib/audience/policy.ts` | Nouveau bloc visible pour novice sans validation pédagogique |
| N2 | **Téléchargement datasets sans support range requests** : le download de fichiers Parquet via Blob API ne supporte pas la reprise sur interruption. Signalé dans RETRO-019. | web/datasets, api/datasets | `apps/web/components/ibis/datasets/files-tab.tsx`, endpoint `/datasets/{id}/files/{file_id}/download` | Téléchargement de grands fichiers non résumable |
| N3 | **`test_index` dans `PreprocessResult` alourdit le joblib sur grands datasets** : pour un dataset >10 M lignes, la liste des indices test ajouterait plusieurs Mo à l'artefact. Signalé dans RETRO-009. | api/ml, api/xai | `apps/api/ibis/modules/ml/preprocessing.py`, artefact `model.joblib` | Artefacts surdimensionnés sur très grands datasets |
| N4 | **Progression `web/challenges` exclusive localStorage** : la progression est perdue lors du vidage du navigateur ou d'un changement d'appareil. Assumé V1, documenté dans la spec-technique web/challenges. | web/challenges | `apps/web/lib/challenges/store.ts` | Expérience utilisateur dégradée en multi-appareils |
| N5 | **Score éthique compute-on-read sans monitoring de latence** : `ethical_score()` est O(10) par dataset, acceptable aujourd'hui. Sans métrique de latence, le seuil critique (~10 000 datasets) sera atteint sans alerte. Signalé dans RETRO-004. | api/datasets | `apps/api/ibis/modules/datasets/service.py` (`to_card`, `to_detail`) | Dégradation silencieuse des performances du catalogue à grande échelle |
| N6 | **Prompts LLM dans `xai_text.py` non versionnés** : les prompts système et les instructions de format BlockDocument sont inline dans le code Python. Toute évolution du schéma BlockDocument nécessite une mise à jour synchrone des prompts. | api/llm, api/xai | `apps/api/ibis/modules/llm/xai_text.py` | Prompts et schéma se désynchronisent lors d'une évolution ; testabilité des prompts difficile |
| N7 | **`AudienceWarning` sans test d'intégration** : le garde-fou visuel quand niveau effectif ≠ profil n'est pas couvert par les tests. Signalé dans RETRO-020. | web/experiments | `apps/web/components/ibis/audience/audience-warning.tsx` | Régression du garde-fou pédagogique non détectable |
| N8 | **Référence bibliographique Khelifi 2024 non vérifiable** : les 10 critères éthiques sont attribués à "Khelifi 2024" dans un commentaire source mais sans lien vers la publication. Impossible de vérifier la fidélité des critères à la source académique. Signalé dans RETRO-003. | api/datasets | `apps/api/ibis/modules/datasets/ethics.py` | Crédibilité académique non vérifiable |
| N9 | **Limite de comparaison (8 expériences) codée en dur** : la limite est inline dans le composant React, sans constante nommée ni configuration. | web/experiments | `apps/web/components/ibis/experiments/project-experiments-tab.tsx` | Toute évolution de la limite nécessite de connaître l'emplacement exact dans le composant |
| N10 | **Seuils de tonalité métrique (`metricTone`) codés en dur** : `>= 0.8 → good`, `>= 0.6 → medium` sont des valeurs inline non configurables. | web/experiments | `apps/web/components/ibis/experiments/result-charts.tsx` | Modification des seuils sans constante nommée ; risque de divergence avec la politique pédagogique |
| N11 | **`purge_stale_running` non couvert par des tests** : la purge des expériences bloquées en statut `running` (seuil 10 min) est une logique de récupération critique sans test dédié. | api/experiments | `apps/api/ibis/modules/experiments/service.py` (`purge_stale_running`) | Comportement de récupération après crash worker non validé |
| N12 | **`vocab.py` candidat à la migration vers `ibis/core/`** : actuellement dans `ml/`, importé par `datasets/`. Déplacer vers `ibis/core/` éliminerait le couplage inter-modules sans changer le contenu. Signalé dans RETRO-011. | api/datasets, api/ml | `apps/api/ibis/modules/ml/vocab.py` | Couplage inter-modules gênant pour l'évolution de l'architecture |

---

## Métriques globales

| Indicateur | Valeur |
|-----------|--------|
| Dette CRITIQUE | 5 items |
| Dette MAJEUR   | 12 items |
| Dette MINEUR   | 12 items |
| **Total**      | **29 items** |
| Couverture tests API | ~65 % (11 modules testés sur 13, 2 zones blanches : llm + tasks Celery) |
| Couverture tests web | ~30 % (8 features testées sur 25 surfaces, concentration sur challenges + formation) |
| Features sans spec documentée | 16 sur 24 (8 documentées : api/datasets, api/experiments, api/ml, api/xai, web/datasets, web/experiments, web/fairness, web/challenges) |
| ADRs actifs | 12 RETRO-* |
| ADRs manquants estimés | ~4 (api/auth ADR sécurité, api/scoring ADR formules, web/wizard ADR brouillon, api/admin ADR audit trail) |
