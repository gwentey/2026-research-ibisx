# Spec Fonctionnelle — api/experiments [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | api/experiments     |
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
| [RETRO-api-experiments-01](../../../adr/RETRO-api-experiments-01.md) | Prohibition de tout repli sur données synthétiques lors de l'entraînement | Documenté (rétro) |
| [RETRO-api-experiments-02](../../../adr/RETRO-api-experiments-02.md) | Modèle crédit : débit à l'entraînement, remboursement conditionnel à l'annulation | Documenté (rétro) |

> *Note : l'adr-linker (v3.0.0) ne reconnaît pas le format de nommage `RETRO-app-feature-NN` — table construite manuellement.*

---

## Contexte et objectif

Le module `api/experiments` expose le backend du wizard ML 9 étapes d'IBIS-X. Il permet à un utilisateur connecté de conduire une expérience d'apprentissage supervisé complète : depuis la sélection d'un dataset jusqu'à la consultation des métriques, en passant par la configuration du préprocessing et le choix de l'algorithme.

L'objectif pédagogique central est l'honnêteté : chaque résultat affiché doit correspondre à un entraînement réel sur les données de l'utilisateur, avec les prétraitements effectivement appliqués exposés dans les résultats.

---

## Règles métier (déduites du code)

1. **Un seul brouillon actif par triplet (utilisateur, projet, dataset).** Un `PUT /experiments/draft` crée ou met à jour (upsert) le brouillon existant pour ce triplet — il n'y a jamais deux brouillons simultanés pour la même combinaison.

2. **Le brouillon est promu en place lors du lancement.** Quand `POST /experiments` est appelé, le brouillon existant (s'il y en a un) est modifié en expérience `pending` plutôt que de créer une nouvelle ligne — le `draft_state` est effacé.

3. **Quotas par utilisateur : 3 simultanés, 20 par jour.** Ces valeurs sont configurables via les variables d'environnement `MAX_CONCURRENT_TRAININGS` et `MAX_DAILY_TRAININGS`. Le décompte journalier exclut les brouillons (statut `draft`).

4. **1 crédit débité au lancement, avant la mise en file Celery.** Si l'utilisateur n'a pas de crédit, l'entraînement est refusé avec un code HTTP 402 (`INSUFFICIENT_CREDITS`).

5. **Remboursement uniquement si l'expérience était encore `pending` au moment de l'annulation.** Si le worker a déjà démarré (`running`), le crédit n'est pas remboursé.

6. **L'algorithme doit appartenir au registre.** Seuls `decision_tree` et `random_forest` sont acceptés ; tout autre algorithme est rejeté en 422 (`UNKNOWN_ALGORITHM`) dès la route, avant même la vérification des quotas.

7. **Les hyperparamètres sont validés strictement contre le schéma Pydantic de l'algorithme** (`extra="forbid"`). Les valeurs inconnues ou hors-bornes sont rejetées en 422 (`INVALID_HYPERPARAMETERS`).

8. **`random_state` verrouillé à 42.** La valeur est un littéral Pydantic (`Literal[42]`) dans `PreprocessingConfig` : elle ne peut pas être modifiée via le payload client.

9. **Aucun entraînement de secours sur données synthétiques.** Si le fichier de données est indisponible ou si le nettoyage rend le DataFrame vide, la tâche échoue explicitement avec un `error_code` typé — jamais de génération de données de substitution.

10. **Les résultats ne sont accessibles que sur une expérience `completed`.** Toute tentative sur une expérience dans un autre statut retourne un 409 (`NOT_COMPLETED`).

11. **La comparaison d'expériences nécessite entre 2 et 8 expériences terminées**, toutes appartenant à l'utilisateur appelant.

12. **La suppression d'une expérience active est bloquée.** Il faut d'abord annuler, puis supprimer.

13. **L'artefact `.joblib` est nettoyé en cas d'échec ou d'annulation.** Le fichier partiel n'est jamais laissé orphelin dans le stockage.

14. **Les expériences zombies (statut `running` sans battement > 10 minutes) sont automatiquement passées en `failed` avec le code `WORKER_LOST`.** Cette purge est exécutée par une tâche de maintenance périodique.

15. **Les brouillons sont exclus de toutes les listes et du benchmarking.** `GET /experiments` et `GET /projects/{id}/experiments` n'exposent que les expériences non-`draft`.

---

## Cas d'usage (déduits)

### CU-001 — Reprise d'un wizard interrompu

Un utilisateur a commencé à configurer une expérience dans le wizard (par exemple, sélectionné un dataset et une colonne cible à l'étape 2). Il ferme le navigateur. À la prochaine session, le frontend appelle `GET /experiments/draft?project_id=...&dataset_id=...` et récupère le `draft_state` JSONB sauvegardé par le dernier `PUT /experiments/draft`. Le wizard se ré-hydrate à l'étape où l'utilisateur s'était arrêté.

### CU-002 — Lancement d'un entraînement

À l'étape 8 du wizard, l'utilisateur clique sur « Lancer ». Le frontend envoie `POST /experiments` avec l'algorithme, les hyperparamètres et la configuration de préprocessing. Le serveur valide l'algorithme, vérifie les quotas, débite un crédit, crée (ou promeut le brouillon en) une expérience `pending`, soumet la tâche Celery, et retourne immédiatement le détail de l'expérience. Le frontend suit la progression via `GET /experiments/{id}` (polling ou SSE via `/jobs/{id}/events`).

### CU-003 — Consultation des résultats

Lorsque l'expérience passe en `completed`, l'utilisateur accède à `GET /experiments/{id}/results` qui retourne : métriques, données de visualisation JSON (matrice de confusion, courbes ROC/PR, predicted vs actual, résidus), importance des features, préprocessing appliqué, et score composite. Ces données alimentent les composants Recharts côté client.

### CU-004 — Annulation d'un entraînement en cours

L'utilisateur clique sur « Annuler » depuis la page de suivi. Le serveur envoie un signal de révocation Celery (`celery_app.control.revoke(task_id, terminate=True)`), passe l'expérience en `cancelled`, met à jour le job associé, et — si l'expérience était encore `pending` — rembourse le crédit.

### CU-005 — Benchmarking de deux algorithmes

L'utilisateur soumet `POST /experiments/compare` avec les IDs de deux expériences terminées. Le serveur aligne les métriques communes et retourne une `CompareResponse` avec les métriques communes ordonnées (`f1_macro`, `accuracy`, etc.) pour chaque expérience.

### CU-006 — Téléchargement du modèle entraîné

L'utilisateur clique sur « Télécharger le modèle ». Le serveur stream le fichier `models/{experiment_id}/model.joblib` depuis le backend de stockage. Ce fichier contient le modèle sklearn sérialisé, le pipeline de prétraitement, l'encodeur de labels, les noms de features et la configuration d'entraînement.

---

## Dépendances

- **api/auth** : dépendance obligatoire sur `CurrentClaims` et `CurrentUser` — toutes les routes sont protégées par JWT.
- **api/datasets** : `get_dataset()` et `load_file_dataframe()` pour vérifier l'existence du dataset et charger les données.
- **api/projects** : `get_project()` pour l'isolation par projet (vérification que le projet appartient à l'utilisateur).
- **api/jobs** : `create_job()`, `update_progress()` pour la traçabilité des tâches asynchrones (statut, progression, SSE).
- **api/ml** : `algorithms.py` (registre, validation, build estimateur), `preprocessing.py`, `evaluation.py`, `quality.py` — le module `api/ml` est le moteur interne du pipeline d'entraînement.
- **Celery / Redis** : la tâche `train_experiment` est soumise à la queue `training` ; la progression est publiée sur Redis pub/sub.
- **Stockage backend** : `get_storage()` pour persister et streamer les artefacts `.joblib`.

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Cycle de vie des brouillons dans le temps** : un brouillon orphelin (créé mais jamais lancé) est-il nettoyé automatiquement ? Aucune purge de brouillons n'a été identifiée dans le code de maintenance.
- **Limite de la liste globale** : `GET /experiments` est plafonné à 200 résultats (`limit(200)`). Ce plafond est-il suffisant et intentionnel ?
- **Comportement de `purge_stale_running`** : cette fonction est appelée par une tâche de maintenance (`max_minutes=10`), mais la fréquence de cette tâche périodique n'a pas été vérifiée dans le scheduler Celery.
- **Isolation projet vs dataset** : un utilisateur peut-il créer une expérience avec un dataset appartenant à un autre utilisateur ? Le code vérifie que le projet appartient à l'utilisateur (`get_project`), mais `get_dataset` ne filtre pas par `user_id` — les datasets publics/partagés semblent accessibles.
