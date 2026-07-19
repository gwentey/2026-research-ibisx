# Spec Fonctionnelle — api/xai [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | api/xai             |
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
| [RETRO-api-xai-01](../../../adr/RETRO-api-xai-01.md) | Niveau d'audience capturé immuablement par explication | DATA-MODEL | Documenté (rétro) |
| [RETRO-api-xai-02](../../../adr/RETRO-api-xai-02.md) | Contrat BlockDocument pour les réponses de chat XAI | DATA-MODEL | Documenté (rétro) |

---

## Contexte et objectif

Le module `api/xai` fournit l'explicabilité post-hoc des modèles ML entraînés sur la plateforme IBIS-X. Pour une expérience terminée, il produit des explications globales (importance des variables sur l'ensemble du dataset de test) et des explications locales (contribution de chaque variable pour une instance précise), calcule des indicateurs de qualité d'explication, analyse l'équité par attribut sensible, et expose un chat asynchrone permettant à l'utilisateur d'interroger le modèle en langage naturel avec des réponses formatées en blocs riches.

L'objectif déclaré dans les commentaires source est de corriger les mensonges de la v1 : importance Gini relabellisée "SHAP", chiffres de qualité fictifs, chat HTTP bloquant (60 s), KPI absents. La v2 calcule tous les chiffres réellement, les expose honnêtement, et gère l'asynchronisme.

---

## Règles métier (déduites du code)

1. **Prérequis expérience terminée** : une explication ne peut être demandée que si l'expérience est au statut `completed`. Tout autre statut lève une erreur `ConflictError`.

2. **Explication locale requiert une instance** : pour `type=local`, le champ `instance_index` est obligatoire. L'absence lève `ConflictError(code="INSTANCE_REQUIRED")`.

3. **Coût en crédits** : chaque demande d'explication consomme 1 crédit utilisateur au moment de la création (pas à la complétion). Si `user.credits < 1`, une erreur 402 est renvoyée.

4. **Sélection automatique de méthode** : en mode `auto`, SHAP TreeExplainer est sélectionné si le modèle possède un attribut `tree_` ou `estimators_` (arbre ou forêt), LIME sinon. Si `method=shap` est demandé explicitement sur un modèle non arborescent, le système replie sur LIME en documentant la justification. La justification est persistée sur l'entité `Explanation`.

5. **SHAP multiclasse = mean|abs|** : pour les problèmes multiclasses, les valeurs SHAP par classe sont agrégées par la moyenne des valeurs absolues (`mean_abs`). Cette politique est tracée dans les métadonnées de l'explication.

6. **Reproductibilité P4** : `random_state=42` est utilisé sur toute opération non-déterministe (sous-échantillonnage, LIME, stabilité). Le modèle est rechargé depuis l'artefact original et le preprocessing est rejouté avec le même split (`preprocess(df, config)` avec `random_state=42`). Cela garantit que l'explication est reproductible à l'identique.

7. **LIME global = agrégation de 50 explications locales** : l'explication globale LIME agrège les poids absolus de 50 instances tirées aléatoirement (seed 42) sur le jeu de test. Elle est étiquetée `"note": "aggregation_of_local_explanations"` dans les métadonnées pour honnêteté.

8. **KPI qualité toujours calculés (ou absents, jamais inventés)** : complétude SHAP (axiome d'efficience |Σφᵢ + E[f(X)] − f(x)| / max(|f(x)|, ε) < 1 %), stabilité Spearman sur 5 ré-échantillonnages (seeds 42–46), fidélité LIME (R²), accord inter-méthodes (Spearman SHAP↔LIME), parcimonie (plus petit k couvrant 80 % du poids). Un KPI non calculable est absent du document — jamais une valeur par défaut.

9. **Accord inter-méthodes calculé en bonus** : pour les explications globales SHAP sur un jeu de test d'au moins 10 instances, une explication LIME globale est calculée en parallèle uniquement pour comparer les classements. Le résultat est stocké dans `quality_kpis.inter_method_agreement` et un graphe de comparaison dans `viz_data.method_comparison`.

10. **Niveau d'audience capturé de façon immuable** : à la création d'une explication, le niveau effectif (`novice/intermediate/expert`) est capturé dans `audience_level`. La surcharge éphémère « Voir en tant que » (paramètre `audience` de la requête) prime sur le profil utilisateur mais ne modifie jamais `user.xai_audience`. Une fois créée, `audience_level` de l'explication ne change plus.

11. **Anti-hallucination LLM** : le prompt envoyé au LLM ne contient que les vraies valeurs numériques calculées. Chaque nombre cité en sortie doit être retrouvé dans ce contexte, sinon le texte est rejeté et régénéré (jusqu'à 2 tentatives). Sans clé LLM ou après 2 échecs, un texte déterministe est généré à partir des vraies données, marqué `is_fallback=true`.

12. **Session de chat** : une session de chat ne peut être créée que sur une explication `completed`. Elle est limitée à `max_questions` questions (configurable via `settings.max_chat_questions`). Chaque question est envoyée en tâche asynchrone sur la queue `llm`. La session expire après `chat_session_timeout_hours` heures d'inactivité.

13. **Réponses de chat en blocs structurés (v2)** : les réponses de l'assistant sont des documents JSON validés contre un schéma Pydantic (`BlockDocument`) comprenant jusqu'à 16 blocs de 7 types : `paragraph`, `heading`, `list`, `table`, `callout`, `keyValue`, `featureImpact`. Les couleurs utilisent des tonalités sémantiques (`neutral/accent/positive/negative/warning`), jamais des valeurs hex. En cas d'échec de validation ou d'hallucination, un document déterministe est retourné, badgé `"Generated without AI"`.

14. **Analyse d'équité limitée à la classification** : l'endpoint `/fairness` retourne `{"applicable": false, "reason": "regression"}` pour les modèles de régression. Il n'y a pas d'erreur, juste une indication de non-applicabilité.

15. **Analyse d'équité limitée à 12 groupes** : si la colonne sensible contient plus de 12 valeurs distinctes, une erreur `InvalidInputError(code="FAIRNESS_TOO_MANY_GROUPS")` est levée. Cela protège contre une analyse sans sens sur des colonnes continues (ex. âge).

16. **Métriques d'équité** : en binaire, taux de sélection (parité démographique), taux de vrais positifs (égalité des chances), exactitude, et ratios de disparité incluant la règle des 80 % (`four_fifths_pass: true/false`). En multiclasse, exactitude par groupe uniquement.

17. **Instances de test triées par erreur côté serveur** : l'endpoint `/test-instances` retourne les instances du jeu de test avec leur prédiction réelle vs attendue, triées par erreur décroissante par défaut. La pagination est gérée côté serveur.

---

## Cas d'usage (déduits)

### CU-001 — Demander une explication globale SHAP

Un utilisateur avec des crédits disponibles soumet une demande d'explication `type=global, method=auto` sur une expérience terminée. Le système détecte un modèle arborescent, déduit la méthode `shap_tree`, publie un job sur la queue `xai`, et retourne immédiatement (HTTP 202) avec le statut `pending`. Le worker calcule l'importance globale (top 15 variables), les données beeswarm (top 8), les KPI de stabilité et de parcimonie, génère le texte adaptatif LLM, puis marque l'explication `completed`.

### CU-002 — Demander une explication locale LIME

Pour une instance de test sélectionnée dans le tableau `/test-instances`, un utilisateur soumet `type=local, method=lime, instance_index=3`. LIME calcule les contributions pour cette instance (top 10 features), mesure la fidélité R², et génère un texte adaptatif.

### CU-003 — Interroger le copilote de chat

Sur une explication `completed`, l'utilisateur crée une session de chat et pose une question. La question est persistée comme message `role=user`, une tâche asynchrone est envoyée sur la queue `llm`. L'interface poll jusqu'à ce qu'un message `role=assistant` apparaisse avec un document de blocs structurés.

### CU-004 — Consulter l'analyse d'équité

L'utilisateur sélectionne une colonne sensible (ex. `gender`) et l'endpoint retourne les métriques par groupe. Pour un problème binaire, la règle des 80 % indique si le ratio de taux de sélection entre les groupes respecte le seuil légal.

### CU-005 — Régénérer une explication avec surcharge de niveau

Sur la page résultats, l'utilisateur bascule en mode « Voir en tant que novice » et re-demande une explication. Le paramètre `audience=novice` est transmis sans modifier le profil permanent.

---

## Dépendances

- `api/experiments` : `get_experiment()` pour vérifier propriété et statut
- `api/ml` : `preprocessing.py` pour rejouer le split et le preprocessing (reproductibilité P4)
- `api/jobs` : création et suivi de progression des tâches Celery (queue `xai` pour les explications, queue `llm` pour le chat)
- `api/llm` : `llm/client.py` pour les appels LLM, `llm/xai_text.py` pour la construction des prompts et des contextes
- `api/auth` : `XaiAudience` enum (défini dans `auth/models.py`), `user.credits` pour la facturation
- `api/datasets` : `service.load_file_dataframe()` pour recharger le dataset source (équité, preprocessing)
- SHAP 0.49, LIME 0.2 (dépendances Python directes, cf. ADR-006)
- `ibis.storage` : `get_storage()` pour charger l'artefact joblib du modèle

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- La valeur par défaut de `max_chat_questions` et `chat_session_timeout_hours` vient de `settings` (variable d'env) — la valeur concrète n'est pas visible dans ce module.
- L'endpoint `/suggested-questions` délègue à `llm/xai_text.suggested_questions()` — le contenu exact des questions générées dépend de la clé LLM et du modèle configuré.
- La politique de facturation (1 crédit) semble hardcodée en commentaire `CDC §3.3` — il faudrait valider si ce CDC est encore la référence authoritative ou s'il a évolué.
- `purge_expired_chat_sessions()` est référencé comme tâche Celery beat dans le commentaire `ADR-004` — vérifier que la planification beat est bien configurée en production.
