# Spec Fonctionnelle — api/dashboard [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | api/dashboard       |
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

| ADR | Titre | Catégorie |
|-----|-------|-----------|
| [RETRO-api-dashboard-01](../../../adr/RETRO-api-dashboard-01.md) | `success_rate` absent (None) quand aucune expérience terminée | DATA-MODEL |

---

## Contexte et objectif

Le dashboard fournit à chaque utilisateur connecté une vue synthétique de son activité personnelle sur la plateforme IBIS-X. L'objectif déclaré dans le code (commentaire M7, CDC §10) est de ne présenter que des chiffres issus d'agrégations SQL réelles : zéro valeur décorative, zéro donnée interpolée.

Ce module sert de point d'entrée principal après connexion : l'utilisateur y voit en un appel l'état de ses expériences, projets, et s'il dispose d'un brouillon de wizard en attente.

## Règles métier (déduites du code)

1. **Isolation utilisateur stricte** : toutes les requêtes sont filtrées sur `user_id` issu du JWT. Un utilisateur ne peut pas voir les données d'un autre.

2. **Exclusion des brouillons des compteurs** : le `total_experiments` exclut les expériences au statut `draft`. Un brouillon en cours de wizard n'est pas une expérience au sens du reporting.

3. **Taux de succès absent jusqu'à la première expérience terminée (P1)** : `success_rate` est `null` (pas `0.0`) tant qu'aucune expérience n'a le statut `completed` ou `failed`. Afficher 0 % pour un compte neuf serait mensonger. Voir ADR [RETRO-api-dashboard-01](../../../adr/RETRO-api-dashboard-01.md).

4. **Calcul du taux de succès** : `completed / (completed + failed)`, arrondi à 4 décimales. Les expériences annulées (`cancelled`) ne sont pas comptabilisées comme « terminées » dans ce dénominateur.

5. **Durée moyenne uniquement sur les expériences réussies** : `average_duration_seconds` est la moyenne de `duration_seconds` sur les expériences `completed` uniquement. Retourne `null` si aucune expérience complétée.

6. **Fil d'activité mixte, limité à 10 éléments** : les 10 dernières expériences (non-draft) et les 10 dernières explications sont chargées séparément, fusionnées en application et re-triées par `created_at` décroissant. Le résultat est tronqué à 10 éléments.

7. **Brouillon en attente (pending_draft)** : le brouillon le plus récemment modifié est exposé avec les informations de reprise du wizard (experiment_id, project_id, dataset_id, dataset_name). Un seul brouillon est exposé à la fois.

8. **Projets récents limités à 4** : les 4 projets les plus récemment mis à jour sont listés.

## Cas d'usage (déduits)

### CU-001 — Compte neuf : tableau de bord vide mais honnête

Un utilisateur vient de s'inscrire et n'a encore rien fait. L'appel `GET /dashboard` retourne :
- `total_experiments = 0`
- `active_projects = 0`
- `success_rate = null` (pas `0.0`)
- `average_duration_seconds = null`
- `recent_activity = []`
- `recent_projects = []`
- `pending_draft = null`

### CU-002 — Compte actif avec expériences mixtes

L'utilisateur a 3 expériences terminées (2 `completed`, 1 `failed`), 1 brouillon en cours, et 2 projets. Le dashboard retourne :
- `total_experiments = 3` (le brouillon est exclu)
- `active_projects = 2`
- `success_rate = 0.6667`
- `average_duration_seconds` = moyenne des durées des 2 expériences `completed`
- `recent_activity` = les expériences non-draft + explications éventuelles, fusionnées
- `pending_draft` renseigné avec le brouillon le plus récent

### CU-003 — Reprise de wizard

L'utilisateur a un brouillon au step 3. Le dashboard expose `pending_draft` avec l'`experiment_id` et le `dataset_name` pour que le frontend puisse afficher un bouton "Reprendre".

## Dépendances

- **api/auth** — `CurrentClaims` : fournit le `user_id` et vérifie le JWT avant chaque appel
- **api/experiments** — modèle `Experiment` et enum `ExperimentStatus` : source des KPI et de l'activité
- **api/projects** — modèle `Project` : source des compteurs et de la liste récente
- **api/datasets** — modèle `Dataset` : joint pour obtenir `display_name` dans l'activité et le brouillon
- **api/xai** — modèle `Explanation` et enum `ExplanationStatus` : source de l'activité récente (côté explications)
- **ibis.db.engine** — `get_db` : session SQLAlchemy injectée par FastAPI

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Signification de "projets actifs"** : le compteur `active_projects` compte TOUS les projets de l'utilisateur sans filtre de statut. Le modèle `Project` n'a pas de champ `is_active` ou de statut. Il est possible que "actif" soit simplement synonyme de "existant" — à confirmer avec le dev.
- **Signification de "cancelled" dans success_rate** : les expériences `cancelled` sont exclues du dénominateur `finished`. Est-ce intentionnel ? Une annulation devrait-elle être considérée comme un échec pour le taux de succès ?
- **Granularité de la troncature activité** : le code charge 10 expériences + 10 explications, puis tronque à 10 après fusion. Si les dernières explications sont très récentes, des expériences récentes peuvent disparaître de la liste. Cette borne de 10 côté DB + 10 côté application est-elle un choix de performance délibéré ?
