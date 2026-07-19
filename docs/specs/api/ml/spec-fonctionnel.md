# Spec Fonctionnelle — api/ml [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | api/ml              |
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

| ADR | Titre | Catégorie | Statut |
|-----|-------|-----------|--------|
| [RETRO-009](../../../adr/RETRO-009.md) | test_index dans PreprocessResult : alignement prédictions/attributs bruts | DATA-MODEL | Documenté (rétro) |
| [RETRO-010](../../../adr/RETRO-010.md) | viz_data stocké en JSON pur, jamais en PNG/base64 | DATA-MODEL | Documenté (rétro) |
| [RETRO-011](../../../adr/RETRO-011.md) | Vocabulaire canonique unique de nettoyage (vocab.py) | DATA-MODEL | Documenté (rétro) |

ADRs existants (projet) directement liés à ce module :
| ADR | Titre | Lien |
|-----|-------|------|
| [ADR-006](../../../adr/ADR-006-ia-xai-llm.md) | Bibliothèques IA : ML, XAI et LLM (random_state=42, registre d'algorithmes) | Accepté |

---

## Contexte et objectif

Le module `api/ml` est le moteur ML interne de la plateforme IBIS-X. Il est invisible de l'utilisateur final — il n'expose aucun endpoint HTTP direct — mais constitue le substrat de deux fonctionnalités majeures : le pipeline d'entraînement (wizard 9 étapes) et l'explainabilité XAI. Son rôle est de garantir que le cycle ML (préparation des données → entraînement → évaluation) est **honnête** (ce qui est appliqué est affiché), **reproductible** (même dataset + même config → même résultat) et **extensible** (ajouter un algorithme = 1 fichier + 1 entrée registre).

---

## Règles métier (déduites du code)

1. **Reproductibilité inconditionnelle** : `random_state=42` est verrouillé à la valeur littérale dans `PreprocessingConfig` (`Literal[42]`). Un utilisateur ne peut pas changer cette valeur, même en mode expert. Deux exécutions sur le même dataset avec la même config produisent un résultat bit-for-bit identique.

2. **Catalogue fermé d'algorithmes** : seuls les algorithmes référencés dans `REGISTRY` (`decision_tree`, `random_forest` en v1) sont acceptés. Toute tentative d'entraîner un algorithme hors catalogue lève une `InvalidInputError` avec code `UNKNOWN_ALGORITHM`. Il n'y a pas de recommandation d'algorithme hors catalogue.

3. **Hyperparamètres validés à la source** : les hyperparamètres sont validés par le schéma Pydantic (`extra="forbid"`) de l'algorithme concerné avant tout entraînement. Un hyperparamètre inconnu ou hors borne est refusé à la création de l'expérience (code `INVALID_HYPERPARAMETERS`).

4. **Vocabulaire canonique de nettoyage** : les 8 stratégies de traitement des valeurs manquantes (`mean`, `median`, `most_frequent`, `constant`, `knn`, `iterative`, `drop_rows`, `drop_column`) forment une liste fermée dans `vocab.py`. Aucun alias n'est accepté. Un nom de stratégie inconnu est refusé par le validateur Pydantic de `PreprocessingConfig`.

5. **Pipeline fit sur train uniquement** : le `ColumnTransformer` est ajusté (`fit_transform`) exclusivement sur les données d'entraînement. Les données de test ne sont que transformées (`transform`), jamais ajustées. Cette règle prévient toute fuite de données (data leakage).

6. **Récapitulatif honnête** : chaque étape de preprocessing (suppression de colonnes, normalisation de tokens, drop de lignes, exclusion de colonnes identifiantes, stratégies d'imputation appliquées, paramètres du split) est enregistrée dans le dictionnaire `applied` retourné par `preprocess()` et persisté dans la colonne `applied_preprocessing` de la table `experiments`. Ce qui est affiché à l'utilisateur correspond exactement à ce qui a été exécuté.

7. **Repli catégoriel documenté** : si une stratégie d'imputation numérique (`mean`, `median`, `knn`, `iterative`) est configurée sur une colonne catégorielle, le module effectue un repli silencieux vers `most_frequent`. Ce repli est explicitement tracé dans `applied.column_strategies` (valeur `"most_frequent"` plutôt que la valeur configurée). L'utilisateur voit le repli.

8. **Classes à instance unique retirées avant le split** : pour une tâche de classification, les classes représentées par une seule ligne sont retirées avant le `train_test_split` afin d'éviter une erreur de stratification. Le retrait est tracé dans `applied.steps`.

9. **Stratification conditionnelle** : le split train/test est stratifié (proportions de classes préservées) si et seulement si chaque classe contient au moins 2 instances après nettoyage.

10. **Évaluation sans image** : les métriques et visualisations produites par `evaluation.py` sont exclusivement du JSON (points de courbes, matrices, séries numériques), jamais des images encodées. Ce JSON est stocké dans la colonne JSONB `viz_data` et rendu par Recharts côté client.

11. **Score qualité dataset 0–100** : l'analyse qualité calcule un score pénalisé : `100 - pénalité_manquants (max 50) - pénalité_outliers (max 40)`. Ce score est mis en cache 7 jours dans la table `quality_analyses` et invalidable par `force=True`.

12. **Pas d'entraînement de secours** : en cas d'erreur dans le pipeline (dataset absent, config invalide, timeout), la tâche échoue explicitement. Il n'y a aucun mécanisme de repli sur des données synthétiques ni de résultats inventés.

---

## Cas d'usage (déduits)

### CU-001 — Lancer un entraînement complet

**Acteur** : worker Celery (déclenché par `api/experiments`)

**Flux principal** :
1. Le worker reçoit `experiment_id` et `job_id`.
2. Chargement du fichier Parquet/CSV depuis le storage.
3. Preprocessing : normalisation des tokens manquants, suppression des colonnes explicites + identifiantes, drop des lignes, encodage de la cible, split stratifié, ColumnTransformer.
4. Construction de l'estimateur sklearn seedé via `build_estimator()`.
5. `estimator.fit(X_train, y_train)`.
6. Évaluation (`evaluate_classification` ou `evaluate_regression`) : métriques + visualisations JSON.
7. Calcul des importances de features (top 20) et de la structure d'arbre (si applicable).
8. Sérialisation de l'artefact joblib (`model`, `preprocessing_pipeline`, `feature_names`, `label_encoder`, `training_config`) sur le storage.
9. Écriture des résultats dans la table `experiments` (`metrics`, `viz_data`, `applied_preprocessing`, `artifact_key`).

**Jalons de progression** : 10 → 30 → 50 → 70 → 90 → 100 publiés sur Redis.

### CU-002 — Consulter l'analyse qualité d'un dataset

**Acteur** : endpoint `api/experiments` (étape 3 du wizard)

**Flux principal** :
1. Appel à `get_or_compute_quality(db, dataset_id)`.
2. Si un cache valide existe en base (non expiré, moins de 7 jours), retour immédiat.
3. Sinon : chargement du fichier, `analyze_dataframe()`, calcul du score, persistance dans `quality_analyses`, retour.

**Règle** : le cache peut être invalidé par `force=True` (utilisé lors d'un re-upload de fichier).

### CU-003 — Obtenir les schémas d'hyperparamètres pour le wizard

**Acteur** : endpoint `api/experiments` (`GET /algorithms`)

**Flux principal** :
1. `hyperparameter_schemas()` retourne la liste des algorithmes du registre, chacun avec son `schema` JSON Schema Pydantic, ses `defaults` et ses `presets` (Équilibré / Haute précision / Rapide).
2. Le frontend utilise ce schéma pour générer dynamiquement le formulaire de l'étape 7.

### CU-004 — Réutiliser le pipeline pour l'XAI

**Acteur** : worker XAI (`explain.py`)

**Flux principal** :
1. Le worker XAI charge l'artefact joblib depuis le storage.
2. Il réexécute `preprocess()` avec la même config pour obtenir un `PreprocessResult` frais (y compris `test_index`).
3. Il utilise `test_index` pour retrouver les valeurs brutes des attributs sensibles dans le DataFrame original, alignées avec `X_test`.

---

## Dépendances

- `ibis/modules/experiments` : pilote le lancement via `train_experiment` Celery ; fournit `PreprocessingConfig` et `Experiment`.
- `ibis/modules/datasets` : fournit `get_dataset()` et `load_file_dataframe()` pour le chargement du fichier source.
- `ibis/modules/jobs` : publication des jalons de progression (Redis pub/sub via `jobs_service.update_progress`).
- `ibis/modules/xai` : consomme `PreprocessResult` (preprocessing.py + artefact joblib) pour l'explainabilité et la fairness.
- `ibis/storage` : abstraction `local`/`s3` pour la lecture du fichier source et la sérialisation du joblib.
- `ibis/modules/datasets/profiling.sanitize_json` : utilisé par `evaluation.py` pour nettoyer les scalaires numpy avant sérialisation JSON.

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Décision D5 mentionnée dans algorithms.py** : le commentaire cite "décision D5" pour le démarrage avec exactement `decision_tree` et `random_forest`. Le document de décision D5 n'a pas été localisé dans `docs/` — à valider.
- **CDC §8.2 et §8.3** : plusieurs fonctions référencent explicitement des sections d'un CDC (Cahier des Charges). Ce document n'est pas dans le dépôt. Les règles métier déduites ici sont cohérentes avec le code mais certaines formulations exactes (ex. matrice de recommandation qualité, coefficients de pénalité) mériteraient confirmation.
- **`TREE_EXPORT_MAX_DEPTH = 4`** : la borne de 4 niveaux pour l'export JSON de l'arbre est codée en dur. La raison de ce choix (lisibilité UI ? performance ?) est inconnue.
- **VIZ_MAX_POINTS = 200** : le sous-échantillonnage des courbes à 200 points max est codé en dur. L'impact visuel sur les courbes ROC pour de très petits datasets n'a pas été évalué.
- **Timeout d'entraînement** : la tâche Celery utilise `get_settings().training_timeout_seconds` (valeur en base ou env). La valeur par défaut et son calcul n'ont pas été inspectés.
