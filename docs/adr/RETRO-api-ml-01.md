# RETRO-api-ml-01 — test_index dans PreprocessResult : alignement prédictions/attributs bruts

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documenté (rétro)   |
| Date       | 2026-07-19          |
| Source     | Rétro-ingénierie    |
| Features   | api/ml, api/xai     |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DATA-MODEL |
| Q1 — Coût de revert > 1j ? | OUI — supprimer `test_index` de `PreprocessResult` invalide tous les artefacts existants (`model.joblib` ne contient pas l'index) ; il faudrait re-entraîner toutes les expériences ET mettre à jour `xai/engine.py` pour trouver une autre source d'alignement |
| Q2 — Non-déductible du code ? | OUI — rien dans `package.json`/`uv.lock`/`pyproject.toml` n'indique pourquoi `PreprocessResult` transporte un `test_index` ; sans ce contexte, un dev croirait que l'index DataFrame standard suffit, et il échouerait silencieusement sur des datasets avec index non-contigu |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — `apps/api/ibis/modules/ml/preprocessing.py` produit le champ ; `apps/api/ibis/modules/xai/engine.py` le consomme pour aligner les attributs sensibles bruts avec les prédictions (analyse d'équité) ; `apps/api/ibis/workers/tasks/train.py` orchestre l'ensemble |
| Q4 — Casse un invariant si ignoré ? | OUI — si `test_index` est absent ou décalé, l'analyse d'équité (`fairness`) produit des ratios calculés sur des instances mal alignées (prédiction de la ligne i associée aux attributs sensibles de la ligne j) : biais silencieux dans les métriques d'équité |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

Le `ColumnTransformer` de scikit-learn réinitialise systématiquement l'index du DataFrame résultant (index entier séquentiel 0…n). Après le `fit_transform`, il est impossible de retrouver quelle ligne du `DataFrame` d'origine correspond à quelle ligne de `X_test`. Or l'analyse d'équité XAI a besoin de récupérer la valeur brute (non transformée) d'un attribut sensible (genre, tranche d'âge, etc.) pour chaque observation du jeu de test, en la croisant avec la prédiction du modèle sur cette même observation.

## Décision identifiée

`PreprocessResult` transporte un champ `test_index: list[Any]` qui capture, après le `train_test_split` et **avant** le `fit_transform`, la liste des indices d'origine du `DataFrame` correspondant aux lignes de test (`list(X_test.index)`). Ce vecteur d'indices est persisté dans l'artefact `model.joblib` et utilisé par `xai/engine.py` pour retrouver les valeurs brutes d'une colonne à partir du `DataFrame` original.

## Conséquences observées

### Positives
- L'analyse d'équité peut afficher les sous-groupes sensibles corrects (ex. : taux de vrais positifs chez les femmes de 25–35 ans) même après encodage et normalisation des colonnes.
- Le code XAI n'a pas à re-charger le fichier source ni à reconstituer le split (ce qui briserait la reproductibilité si l'ordre de lecture changeait).

### Négatives / Dette
- `PreprocessResult` grossit d'un champ qui n'est pas utile si l'expérience n'a pas de module XAI. À surveiller si de nouveaux consommateurs de `PreprocessResult` n'ont pas besoin de cet index.
- Pour de très grands datasets (> 10 M lignes), la sérialisation de `test_index` dans `model.joblib` peut ajouter plusieurs Mo à l'artefact.

## Recommandation

Garder. La suppression casserait l'analyse d'équité et la détection de biais, deux fonctionnalités centrales du produit. Si la taille de l'artefact devient un problème, envisager de le stocker dans une colonne séparée de la table `experiments` plutôt que dans le joblib.
