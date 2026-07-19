# Spec Fonctionnelle — web/admin [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | web/admin           |
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

*Aucun ADR lié.*

> *Table auto-générée par adr-linker. Ne pas éditer manuellement.*

## ADRs

*Aucun ADR lié.*

---

## Contexte et objectif

Le module `web/admin` est le back-office de la plateforme IBIS-X. Il expose une interface tabulaire dense, accessible uniquement aux utilisateurs dont le rôle est `admin`. Il couvre quatre périmètres distincts : la gestion des comptes, la supervision du catalogue de datasets, la configuration des templates d'évaluation éthique par domaine, et la supervision en temps quasi réel des tâches asynchrones exécutées par le worker Celery.

Cette section est référencée comme "surface 13" dans la documentation de refonte visuelle du projet (sobre, aucun gradient, densité tabulaire).

---

## Règles métier (déduites du code)

1. **Restriction de rôle** : l'accès à toute page `/admin/*` exige le rôle `admin`. Le frontend effectue une redirection UX vers `/dashboard` si le rôle est insuffisant ; le backend re-vérifie le rôle en base à chaque requête via `CurrentAdminVerified` (défense en profondeur, indépendante du JWT).

2. **Garde dernier admin actif** : il est impossible de dégrader (changer le rôle vers `user` ou `contributor`), désactiver ou supprimer un compte administrateur s'il est le dernier administrateur actif dans le système. Le backend retourne l'erreur `LAST_ADMIN` dans ce cas ; le frontend affiche un message dédié.

3. **Ajout de crédits additif** : l'ajout de crédits est une opération additive (`user.credits += amount`) dans la plage 1–1000 par opération. Il n'existe pas d'opération de remplacement du solde.

4. **Traçabilité obligatoire** : toute action de mutation effectuée depuis le back-office est enregistrée dans la table `audit_events` avec le contexte (acteur, entité, changement). Les actions tracées sont : `role_changed`, `active_changed`, `credits_granted`, `user_deleted`, `template_upserted`, `template_deleted`, `dataset_reanalyzed`.

5. **Normalisation du domaine de template** : un domaine de template est normalisé côté backend (strip + lowercase + troncature à 50 caractères) avant persistance. La valeur `default` est le domaine de repli utilisé à l'import quand aucun template de domaine spécifique n'existe.

6. **Tristate éthique** : dans l'éditeur de template, chaque critère éthique a trois états possibles — `true` (oui), `false` (non), `unset` (non renseigné). Seules les valeurs définies (`true`/`false`) sont envoyées au backend ; les valeurs `unset` sont exclues du payload.

7. **Templates appliqués à l'import** : les valeurs par défaut définies dans un template sont appliquées au moment de l'import d'un dataset, pas à la lecture. Les datasets déjà importés ne sont pas rétroactivement affectés par une modification de template.

8. **Ré-analyse forcée** : la commande "ré-analyser" un dataset invalide le cache de qualité (7 jours) et force un recalcul immédiat du score qualité. L'opération est asynchrone côté API (statut 202).

9. **Supervision de jobs en temps quasi réel** : la page jobs se raffraîchit automatiquement toutes les 5 secondes via `setInterval`. La liste est limitée aux 100 jobs les plus récents.

10. **Santé des workers Celery** : la page jobs interroge simultanément la liste des jobs et l'état de santé du worker (`GET /worker/health`). Si aucun worker n'est détecté, un avertissement est affiché indiquant que les entraînements resteront en attente.

---

## Cas d'usage (déduits)

### CU-001 — Modifier le rôle d'un utilisateur
Un administrateur accède à `/admin/users`, localise un utilisateur via la barre de recherche, et change son rôle via le menu déroulant en ligne. La modification est immédiatement envoyée au backend. En cas d'erreur `LAST_ADMIN`, un toast d'erreur spécifique est affiché.

### CU-002 — Désactiver / réactiver un compte utilisateur
Depuis le menu d'actions (colonne "…") d'une ligne utilisateur, l'administrateur bascule l'état d'activation. L'action est tracée dans `audit_events`. La garde du dernier admin s'applique également ici.

### CU-003 — Ajouter des crédits à un utilisateur
L'administrateur sélectionne "Crédits" dans le menu d'actions d'une ligne utilisateur. Un dialogue s'ouvre avec un champ numérique (valeur par défaut : 50, plage : 1–1000). La confirmation déclenche un PATCH avec `add_credits`.

### CU-004 — Supprimer un compte utilisateur
L'administrateur choisit "Supprimer" dans le menu d'actions. Une `AlertDialog` de confirmation rappelle que les projets, expériences et explications de l'utilisateur seront supprimés définitivement. La suppression est tracée.

### CU-005 — Ré-analyser la qualité d'un dataset
Depuis `/admin/datasets`, l'administrateur sélectionne "Ré-analyser" sur un dataset. L'action déclenche un POST sur `/admin/datasets/{id}/reanalyze`, qui invalide le cache et recalcule le score qualité. Le résultat (nouveau score) est affiché dans le toast de confirmation.

### CU-006 — Créer ou modifier un template éthique
Depuis `/admin/ethical-templates`, l'administrateur saisit un nom de domaine (ex. `sante`) et clique "Créer / éditer". Un dialogue liste les 10 critères éthiques de la taxonomie Khelifi 2024, chacun avec un sélecteur tristate. L'enregistrement déclenche un PUT (upsert) sur `/admin/ethical-templates/{domain}`.

### CU-007 — Superviser les jobs background
Depuis `/admin/jobs`, l'administrateur filtre par type (entraînement, explication, chat, import, guide, maintenance) et/ou statut (en attente, en cours, terminé, échoué, annulé). La liste se rafraîchit automatiquement toutes les 5 secondes. L'encart "Workers en ligne" affiche les noms des workers Celery actifs.

---

## Dépendances

- **api/admin** — toutes les routes `/admin/*` (users, datasets/reanalyze, ethical-templates, jobs, audit)
- **api/datasets** — `GET /datasets` (liste admin utilise le même endpoint public avec tri par création)
- **api/jobs** — modèle Job partagé avec le module jobs (lecture de la table `jobs`)
- **web/auth** — store Zustand (`useAuthStore`) pour la lecture du rôle courant (UX guard)
- **kit UI** — shadcn/ui : Table, Badge, Dialog, AlertDialog, Select, Input, Card, Skeleton, DropdownMenu
- **i18n** — next-intl, namespaces `admin.*` et `nav.*`

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Page d'audit non implémentée côté front** : l'API expose `GET /admin/audit` (liste des `audit_events`) mais aucune page frontend ne l'affiche. Il est incertain si cette page est prévue, abandonnée, ou simplement non encore développée.
- **Validation des datasets** : le discovery.md mentionne "validation" des datasets comme action admin, mais aucune action "valider" n'apparaît dans le code frontend. Cette action a peut-être été remplacée par "ré-analyser" ou n'est pas encore implémentée.
- **Limite de résultats jobs** : le frontend ne permet pas de configurer la limite (100 jobs fixes). Il est incertain si cette limite est intentionnelle ou si une pagination est prévue.
- **Domaine `default`** : la description des templates mentionne `default` comme domaine de repli. Le comportement exact à l'import quand ni le domaine spécifique ni `default` n'existent n'est pas visible depuis le frontend.
