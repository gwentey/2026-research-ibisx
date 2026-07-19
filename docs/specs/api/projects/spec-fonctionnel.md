# Spec Fonctionnelle — Projects [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | projects            |
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

| ADR | Titre | Statut |
|-----|-------|--------|
| [RETRO-006](../../../adr/RETRO-006.md) | Recommandations déléguées à score_datasets() : invariant P3 | Documenté (rétro) |

> *Table auto-générée par adr-linker. Ne pas éditer manuellement.*

---

## Contexte et objectif

Le module `projects` est le conteneur de niveau supérieur dans le parcours ML d'un utilisateur. Un projet regroupe des expériences d'entraînement et enregistre les préférences de recherche de l'utilisateur sous la forme de critères de filtrage et de pondérations. Ces préférences permettent de classer automatiquement le catalogue de datasets par pertinence (recommandations).

Le module référence CDC §7.2 (normalisation des pondérations) et §7.3 (isolation stricte par user_id), ce qui indique une formalisation en amont des règles décrites ci-dessous.

---

## Règles métier (déduites du code)

1. **Isolation stricte par utilisateur** — un projet appartient à exactement un utilisateur (`user_id`). Toute opération sur un projet d'un autre utilisateur retourne 404, pas 403 : l'existence même du projet est masquée pour les tiers.

2. **Validation des pondérations** — chaque clé de `weights` doit correspondre à un critère connu du module de scoring (`CRITERIA` dans `scoring/formulas.py`). Chaque valeur doit être dans l'intervalle [0, 1]. Un critère inconnu ou une valeur hors bornes déclenche une erreur 422.

3. **Normalisation automatique des pondérations (CDC §7.2)** — si la somme des pondérations dépasse 1, chaque pondération est divisée par la somme totale et arrondie à 4 décimales. Si la somme est inférieure ou égale à 1, les pondérations sont stockées telles quelles. La normalisation s'applique à la création et à la mise à jour.

4. **Validation des critères** — les critères sont validés via le schéma `DatasetFilters` (même schéma que les filtres du catalogue de datasets). Un champ inconnu déclenche une erreur 422 (`extra="forbid"` sur le schéma).

5. **Comptage des critères actifs** — `active_criteria_count` est calculé à chaque lecture, non stocké. Un critère est considéré actif s'il n'est ni `None`, ni `[]`, ni `""`, ni `False`.

6. **Cohérence des recommandations avec le scoring (P3)** — l'endpoint `GET /projects/{id}/recommendations` produit un résultat strictement identique à `POST /datasets/score` avec les mêmes `filters` et `weights`. Aucun calcul de score n'est dupliqué dans le module `projects` : la fonction délègue entièrement à `score_datasets()`.

7. **Ordre de liste** — les projets sont retournés par `updated_at` décroissant (le plus récemment modifié en premier).

8. **Cascade sur suppression** — supprimer un projet supprime automatiquement toutes les expériences associées (FK `ondelete="CASCADE"`).

---

## Cas d'usage (déduits)

### CU-001 — Créer un projet de recherche

Un utilisateur authentifié soumet un nom, une description optionnelle, des critères de filtrage (ex. `{"domains": ["education"]}`) et des pondérations (ex. `{"ethical_score": 0.6, "technical_score": 0.4}`). Le projet est créé, les pondérations normalisées si leur somme dépasse 1, et le projet est retourné avec son identifiant UUID.

### CU-002 — Lister ses projets

L'utilisateur obtient la liste paginée de ses projets (`page`, `page_size` jusqu'à 48). Un paramètre `q` optionnel filtre sur le nom et la description (recherche insensible à la casse, opérateur ILIKE). Les projets sont ordonnés par date de modification décroissante.

### CU-003 — Consulter le détail d'un projet

L'utilisateur accède aux critères, pondérations, et nombre de critères actifs d'un projet identifié par UUID. Si le projet n'existe pas ou appartient à un autre utilisateur, la réponse est 404.

### CU-004 — Mettre à jour les critères et pondérations

L'utilisateur soumet un payload complet (`ProjectInput`) remplaçant le nom, la description, les critères et les pondérations existants. Les mêmes règles de validation et de normalisation s'appliquent.

### CU-005 — Supprimer un projet

L'utilisateur supprime un projet (HTTP 204). Toutes les expériences liées sont supprimées en cascade par la base de données.

### CU-006 — Obtenir les recommandations de datasets

L'utilisateur demande `GET /projects/{id}/recommendations`. Le système applique les critères et pondérations du projet au catalogue complet de datasets via le moteur de scoring, et retourne le classement pondéré (`ScoreResponse`). Ce résultat est garanti identique à `POST /datasets/score` avec les mêmes paramètres (P3).

---

## Dépendances

- **api/auth** — `CurrentClaims` : extrait le `user_id` JWT pour l'isolation ; toutes les routes exigent un token valide.
- **api/scoring** — `score_datasets()` : moteur de recommandation délégué ; `CriterionWeight`, `ScoreResponse` : schémas de résultat.
- **api/datasets** — `DatasetFilters` : schéma de validation des critères stockés en JSONB.
- **api/experiments** — reçoit la cascade de suppression lorsqu'un projet est effacé.

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- Le choix de retourner 404 (plutôt que 403) pour les ressources d'un autre utilisateur est documenté comme "isolation stricte" mais la motivation exacte (sécurité par obscurité, conformité RGPD, convention produit) n'est pas explicitée.
- Les valeurs CDC §7.2 et §7.3 référencées dans les commentaires de code supposent l'existence d'un Cahier des Charges — ce document n'était pas disponible lors de la rétro-ingénierie.
- Il n'est pas clair si un projet sans aucun critère (critères = `{}`) est un état valide volontaire (projet vide en cours de configuration) ou une anomalie tolérée.
- L'absence de relation ORM explicite (`relationship()`) entre `Project` et `Experiment` dans `models.py` est intentionnelle ou un oubli — les cascades passent uniquement par la FK base de données.
