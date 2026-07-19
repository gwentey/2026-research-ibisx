# Spec Fonctionnelle — web/dashboard [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | web/dashboard       |
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

Aucun ADR créé pour cette feature (voir rapport de filtrage ci-dessous).

---

## Contexte et objectif

Le dashboard est la page d'accueil de l'utilisateur connecté (`/dashboard`). Il constitue le cockpit personnel de l'espace de travail IBIS-X : il offre une vue d'ensemble instantanée de l'activité de l'utilisateur (KPIs réels, activité récente, projets récents), un point d'entrée rapide pour reprendre un brouillon de wizard en cours, et des raccourcis vers les actions les plus fréquentes. L'objectif explicite documenté dans le code source est de ne jamais afficher de données fictives ou décoratives — tout chiffre visible est issu d'une agrégation SQL réelle.

---

## Règles métier (déduites du code)

1. **Zéro valeur décorative (P1)** : chaque KPI affiché est une agrégation SQL réelle sur les données de l'utilisateur courant. Le `success_rate` est `null` (affiché « — ») tant qu'aucune expérience n'est arrivée à l'état `completed` ou `failed` ; de même pour `average_duration_seconds`. Il n'est jamais remplacé par un faux 0.

2. **Isolation utilisateur** : toutes les requêtes SQL sont filtrées par `user_id` extrait du JWT. Un utilisateur ne voit jamais les données d'un autre.

3. **Calcul du taux de succès** : `success_rate = completed / (completed + failed)`, arrondi à 4 décimales. La valeur est `null` si aucune expérience n'est ni `completed` ni `failed`. Les expériences à l'état `draft` sont exclues du total `total_experiments`.

4. **Durée moyenne** : calculée uniquement sur les expériences à l'état `completed` (pas `failed`), en secondes, arrondie à 2 décimales.

5. **Activité récente** : les 10 dernières expériences non-brouillon et les 10 dernières explications de l'utilisateur sont récupérées indépendamment, fusionnées et triées par `created_at` descendant. Le frontend n'en affiche que 5.

6. **Projets récents** : les 4 projets les plus récemment mis à jour sont retournés par le backend. Le frontend en affiche au maximum 5 (slice côté client).

7. **Brouillon en cours (pending_draft)** : le brouillon d'expérience le plus récemment modifié (`status = draft`) est détecté côté backend. S'il existe, la carte hero affiche un lien direct vers le wizard avec `projectId` et `datasetId` pré-remplis. S'il n'existe pas, la carte hero affiche un état vide avec un CTA « Nouveau projet ».

8. **Un seul appel réseau** : la page effectue un seul appel `GET /dashboard` au montage du composant (`useEffect`). Toutes les sections (KPIs, activité, projets, brouillon) sont peuplées depuis cette réponse unique.

9. **Affichage conditionnel du signal qualitatif** : le badge de tendance (« Bon niveau » / « À surveiller ») sur le KPI `success_rate` est dérivé de la valeur réelle — `>= 0.5` → trending up, `< 0.5` → trending down. Ce badge n'est pas affiché si la valeur est absente.

10. **Squelette de chargement** : tant que la réponse API n'est pas reçue (`data === null`), la page affiche un ensemble de `Skeleton` sans contenu, sans possibilité de cliquer sur aucun lien.

---

## Cas d'usage (déduits)

### CU-001 — Consultation du tableau de bord avec activité existante

L'utilisateur connecté accède à `/dashboard`. La page affiche un squelette pendant le chargement, puis :
- Un titre de bienvenue personnalisé avec son `pseudo` (ou `given_name`, ou fallback générique).
- La carte hero avec le nom du dataset du brouillon en cours et un bouton « Reprendre l'entraînement en cours » pointant vers `/wizard?projectId=...&datasetId=...`.
- 4 tuiles KPI animées (count-up) : expériences totales, projets actifs, taux de succès (en %), durée moyenne (en secondes).
- Une timeline d'activité récente (5 items max) avec statut sémantique coloré et temps relatif.
- Une liste de projets récents (5 items max) avec monogramme tonal déterministe et temps relatif.
- 3 tuiles d'action rapide : Nouveau projet, Explorer les datasets, Scorer les datasets.

### CU-002 — Premier accès (aucune donnée)

L'utilisateur vient de créer son compte et n'a encore rien créé. La page affiche :
- La carte hero en état vide avec le CTA « Nouveau projet ».
- Les tuiles KPI avec `total_experiments = 0`, `active_projects = 0`, taux de succès = « — », durée moyenne = « — ».
- La timeline d'activité avec l'état vide illustré.
- La liste de projets avec l'état vide illustré.

### CU-003 — Reprise d'un brouillon de wizard

L'utilisateur a un wizard en cours (statut `draft`). La carte hero affiche le nom du dataset concerné et un bouton qui redirige directement vers l'étape en cours du wizard avec les paramètres URL pré-remplis (`projectId`, `datasetId`).

---

## Dépendances

- **API backend** : `GET /dashboard` (module `api/dashboard`, opération `getDashboard`)
- **web/auth** : store Zustand `useAuthStore` — le prénom ou pseudo de l'utilisateur est lu depuis l'état auth pour personnaliser le message d'accueil
- **web/wizard** : la carte hero construit un lien vers `/wizard?projectId=...&datasetId=...` — contrat sur les query params attendus par le wizard
- **web/experiments** : lien « Voir toutes les expériences » → `/experiments` ; lien « Voir » sur chaque item d'activité → `/experiments/:id`
- **web/projects** : lien « Voir tous les projets » → `/projects` ; lien « Ouvrir » → `/projects/:id` ; lien création → `/projects/new`
- **web/datasets** : lien « Explorer les datasets » → `/datasets` ; lien « Scorer les datasets » → `/datasets/score`
- **Composant `MissionStepper`** : affiché dans la carte hero quand un brouillon existe, avec position figée à `"training"`
- **Composant `DomainPattern`** : motif visuel `dots` (chart-2) réservé exclusivement à la carte hero dans le dashboard

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :
- La valeur `"training"` passée à `MissionStepper` est codée en dur dans la carte hero. Il est incertain si elle représente toujours l'étape courante réelle du brouillon ou si c'est une simplification (le brouillon pourrait être à n'importe quelle étape 1–8).
- Le `pending_draft` retourne uniquement le brouillon le plus récent. S'il existe plusieurs brouillons simultanés, les autres sont silencieusement ignorés — comportement voulu ou limitation connue ?
- Les projets récents sont limités à 4 par le backend (`LIMIT 4`) mais le frontend tranche à 5 (`slice(0, 5)`) — la limite effective est donc 4 côté backend. La discordance entre les deux valeurs (4 vs 5) mérite confirmation.
- Aucune logique de rafraîchissement automatique n'est présente (ni polling, ni WebSocket). Le tableau de bord est un snapshot au moment du chargement de la page.
