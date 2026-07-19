# RETRO-011 — Vocabulaire canonique unique de nettoyage (vocab.py)

| Champ      | Valeur                                    |
|------------|-------------------------------------------|
| Statut     | Documenté (rétro)                         |
| Date       | 2026-07-19                                |
| Source     | Rétro-ingénierie                          |
| Features   | api/ml, api/datasets                      |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DATA-MODEL |
| Q1 — Coût de revert > 1j ? | OUI — si les alias silencieux sont réintroduits (ex. `"linear"` → `"median"` implicitement comme en v1), il faudrait corriger `profiling.py`, `quality.py`, `preprocessing.py` et le wizard frontend qui affiche les stratégies recommandées, ainsi que ré-auditer toutes les expériences existantes dont le récap `applied` mentionnerait une stratégie fantôme |
| Q2 — Non-déductible du code ? | OUI — ni `pyproject.toml` ni aucune config n'indique l'existence d'une liste fermée ni la raison de son introduction (réparation d'un bug v1 : 4 vocabulaires divergents avec alias silencieux `linear/spline/ffill → median`) ; seul le commentaire source dans `vocab.py` transmet ce contexte |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — `apps/api/ibis/modules/ml/vocab.py` est importé par `apps/api/ibis/modules/datasets/profiling.py` (spec api/datasets) et par `apps/api/ibis/modules/ml/preprocessing.py` + `quality.py` (spec api/ml) ; le wizard web lit les recommandations issues de `quality.py` et présente les stratégies à l'utilisateur |
| Q4 — Casse un invariant si ignoré ? | OUI — un dev qui ajoute une stratégie hors liste dans `PreprocessingConfig` (ex. `"ffill"` autorisé par un nouveau `Literal`) verrait cette valeur acceptée en config mais non reconnue par `_imputer_for()`, provoquant une `KeyError` en runtime ou un fallback silencieux différent de ce que le récap `applied` affiche |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

La v1 du module de preprocessing définissait les stratégies de nettoyage à quatre endroits distincts (profiling, recommandations qualité, form frontend, logique d'imputation) avec des noms légèrement différents (`"linear"`, `"spline"`, `"ffill"` étaient acceptés et silencieusement convertis en `"median"`). L'audit v2 a identifié ce bug comme cause de la propriété T1/T2/T3 (configuration ignorée, stratégies qui crashaient, scaling toujours appliqué). La v2 centralise la liste dans `ibis/modules/ml/vocab.py` et la ferme.

## Décision identifiée

`apps/api/ibis/modules/ml/vocab.py` définit :
- `MISSING_VALUE_TOKENS` : frozenset des 13 tokens textuels normalisés en `NaN` (seul endroit du code où cette normalisation est définie).
- `CANONICAL_STRATEGIES` : tuple fermé des 8 stratégies légales pour le traitement des valeurs manquantes.

Toute entrée dans `PreprocessingConfig.column_strategies` est validée contre cette liste par un `field_validator` Pydantic. Toute stratégie hors liste est refusée à la création de l'expérience, pas au moment de l'entraînement.

## Conséquences observées

### Positives
- Le récap `applied.column_strategies` retourné après preprocessing reflète exactement la stratégie effectivement appliquée, sans alias ni dérive.
- Les recommandations produites par `quality.py` (étape 3 du wizard) utilisent exactement les mêmes noms que la configuration acceptée par `preprocessing.py` : pas de mismatch possible entre la recommandation et ce que l'imputer exécute.
- `profiling.py` (module `datasets`) importe `MISSING_VALUE_TOKENS` depuis `ml/vocab.py`, garantissant que la détection de faux manquants au profiling et la normalisation au preprocessing sont identiques.

### Négatives / Dette
- `vocab.py` est dans `ibis/modules/ml/` mais importé depuis `ibis/modules/datasets/profiling.py`, créant une dépendance du module datasets vers le module ml. Si datasets devait devenir un service indépendant, ce couplage deviendrait problématique.

## Recommandation

Garder. Si le couplage inter-modules devient gênant, déplacer `vocab.py` dans `ibis/core/` (vocabulaire métier global) sans changer le contenu.
