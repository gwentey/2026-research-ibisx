# RETRO-010 — viz_data stocké en JSON pur, jamais en PNG/base64

| Champ      | Valeur                       |
|------------|------------------------------|
| Statut     | Documenté (rétro)            |
| Date       | 2026-07-19                   |
| Source     | Rétro-ingénierie             |
| Features   | api/ml, api/experiments, web/experiments |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DATA-MODEL |
| Q1 — Coût de revert > 1j ? | OUI — migrer `viz_data` vers du base64 PNG imposerait : modifier le schéma de la colonne JSONB dans la table `experiments`, migrer les données existantes, réécrire `evaluation.py` pour produire des images matplotlib, supprimer les composants Recharts et les remplacer par des `<img>` statiques dans `apps/web`. Plusieurs jours de travail transverses |
| Q2 — Non-déductible du code ? | OUI — le choix de ne PAS utiliser matplotlib/base64 ne se voit dans aucun fichier de config ; seule la note `[NE PAS REPRODUIRE]` dans `evaluation.py` et l'absence de toute dépendance matplotlib dans `pyproject.toml` indiquent l'intention. Un dev partant de zéro pourrait ajouter un `plt.savefig` sans réaliser la conséquence |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — `api/ml` (evaluation.py produit le JSON), `api/experiments` (colonne `viz_data` JSONB persistée en BDD), `web/experiments` (Recharts consomme les structures `confusion_matrix`, `roc_curve`, `pr_curve`, `predicted_vs_actual`, `feature_importance`, `tree_structure`) |
| Q4 — Casse un invariant si ignoré ? | OUI — un dev qui ajoute du base64 PNG dans `viz_data` rend la colonne illisible par Recharts, fait sauter le budget de stockage (un PNG base64 de courbe ROC ≈ 50–200 Ko vs < 5 Ko en JSON échantillonné), et retire toute interactivité des graphiques côté web |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

La v1 du projet stockait des images matplotlib encodées en base64 dans la base de données. Cette approche produisait des artefacts statiques non interactifs, gonflait le stockage BDD, et empêchait toute personnalisation de l'affichage côté client (tooltips, zoom, filtres par classe). La v2 choisit de stocker uniquement les points de données bruts (séries numériques, matrices, listes) et de déléguer le rendu à Recharts sur le frontend.

## Décision identifiée

`evaluation.py` produit exclusivement du JSON structuré : matrices de confusion (liste de listes), courbes ROC/PR (listes de points `{fpr, tpr}` ou `{precision, recall}` échantillonnés à 200 points max), scatter `predicted_vs_actual`, histogramme des résidus, listes d'importances de features. Aucun appel à matplotlib. Ce JSON est stocké dans la colonne JSONB `viz_data` de la table `experiments` et consommé directement par les composants Recharts de `apps/web/components/ibis/experiments/result-charts.tsx`.

## Conséquences observées

### Positives
- Les graphiques sont interactifs (tooltips Recharts, zoom, responsive).
- La colonne `viz_data` reste compacte (quelques Ko par expérience) même pour des datasets de taille moyenne.
- Le format JSON permet des transformations côté client sans round-trip API supplémentaire.

### Négatives / Dette
- La structure exacte de `viz_data` n'est pas validée par un schéma Pydantic dédié : si l'évaluation émet un champ renommé, le frontend échoue silencieusement (graphique vide sans erreur visible).

## Recommandation

Garder. Envisager de typer `viz_data` avec un schéma Pydantic versioned pour éviter les dérives silencieuses entre backend et frontend.
