# RETRO-api-experiments-01 — Prohibition de tout repli sur données synthétiques lors de l'entraînement

| Champ      | Valeur                          |
|------------|---------------------------------|
| Statut     | Documenté (rétro)               |
| Date       | 2026-07-19                      |
| Source     | Rétro-ingénierie                |
| Features   | api/experiments                 |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DATA-MODEL |
| Q1 — Coût de revert > 1j ? | OUI — Ajouter un repli synthétique exigerait de redéfinir les contrats de résultats (métriques, applied_preprocessing), de mettre à jour les claims d'honnêteté dans l'UI, les tests d'intégration M5 (dont le test `test_dataset_unavailable_is_explicit_failure`) et la documentation — soit bien plus d'une journée de changements transverses. |
| Q2 — Non-déductible du code ? | OUI — La prohibition est formulée comme commentaire de module `[NE PAS REPRODUIRE] T6` dans `train.py` et comme assert comportemental dans les tests d'intégration ; elle n'est visible dans aucun fichier de config, `pyproject.toml` ou variable d'environnement. |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — api/experiments (enforce la prohibition dans la tâche `train_experiment`), api/ml (`train.py` est le point d'application), web/experiments (affiche les résultats en postulant qu'ils reflètent un entraînement réel). |
| Q4 — Casse un invariant si ignoré ? | OUI — Un dev ajoutant de la « dégradation gracieuse » (repli sur données générées ou sous-échantillonnées synthétiquement) produirait des métriques trompeuses présentées à l'utilisateur comme issues d'un entraînement réel, violant le principe d'honnêteté P6 du produit. |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

IBIS-X est un outil pédagogique destiné à enseigner l'IA de façon honnête. Le principe P6 (honnêteté des résultats) impose que toute métrique affichée corresponde à un entraînement effectif sur les données réelles de l'utilisateur. Des approches alternatives — comme générer un dataset synthétique de secours quand le fichier Parquet est manquant, ou entraîner sur un sous-échantillon aléatoire quand le dataset est trop grand — auraient pu être implémentées pour éviter les erreurs, mais ont été explicitement rejetées.

Le commentaire `[NE PAS REPRODUIRE] T6` dans `apps/api/ibis/workers/tasks/train.py` marque cette décision comme un invariant à préserver dans toutes les modifications futures du pipeline.

## Décision identifiée

Lorsque le fichier de données est indisponible (`DATASET_UNAVAILABLE`) ou que le nettoyage produit un DataFrame vide (`CLEANING_CONFIG_INVALID`), la tâche Celery `train_experiment` lève immédiatement une `AppError` ou `NotFoundError`, passe l'expérience en statut `failed` avec un `error_code` explicite, et retourne `"failed"`. Aucune donnée synthétique n'est générée, aucun entraînement partiel n'est effectué, et l'artefact partiel est supprimé du stockage.

Ce comportement est validé par le test `test_dataset_unavailable_is_explicit_failure` dans `tests/integration/test_experiments_api.py`.

## Conséquences observées

### Positives
- Les métriques affichées reflètent toujours un entraînement réel ; l'utilisateur peut leur faire confiance.
- Les erreurs sont explicites, typées (`error_code`) et affichées dans l'UI, permettant à l'utilisateur de comprendre et corriger.
- La suite de tests peut valider le comportement d'échec sans dépendre d'un comportement de repli non déterministe.

### Négatives / Dette
- Une expérience échoue de façon irréversible si le fichier de données est temporairement indisponible (ex. : stockage S3 dégradé). Il n'existe pas de mécanisme de retry côté entraînement pour les erreurs de données (contrairement aux erreurs réseau `ConnectionError`/`TimeoutError` qui bénéficient d'un `autoretry_for`).

## Recommandation

Garder. L'invariant d'honnêteté est central à la proposition de valeur du produit. Si la résilience au stockage dégradé est nécessaire, implémenter un retry spécifique à l'erreur `DATASET_UNAVAILABLE` plutôt que de revenir sur la prohibition du repli synthétique.
