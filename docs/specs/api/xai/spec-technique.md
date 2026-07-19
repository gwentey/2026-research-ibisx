# Spec Technique — api/xai

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | api/xai             |
| Version       | 0.2.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie + évolutions XAI §2/§3/§4 |

---

## Architecture du module

Le module se décompose en 6 couches :

```
routes.py          — Schémas Pydantic des requêtes/réponses, endpoints FastAPI (HTTP 202/201)
service.py         — Cycle de vie des entités (Explanation, ChatSession, ChatMessage), quotas, crédits
engine.py          — Calcul SHAP/LIME (pur, sans I/O DB), sélection de méthode, reconstruction déterministe
fairness.py        — Calcul d'équité par groupe (fonction pure compute_group_fairness + wrapper fairness_report)
quality.py         — KPI de qualité (fonctions pures : complétude, stabilité, fidélité, accord, parcimonie)
blocks.py          — Schéma BlockDocument (Pydantic), parsing LLM, fallback déterministe
models.py          — ORM SQLAlchemy : Explanation, ChatSession, ChatMessage
workers/tasks/explain.py — Tâches Celery : generate_explanation (queue xai), answer_chat_question (queue llm) ; helpers factorisés _blocks_completion, _fallback_payload, _generate_explanation_blocks
```

La séparation entre `engine.py`/`fairness.py`/`quality.py` (pur calcul, pas d'I/O DB) et `service.py`/`workers/tasks/explain.py` (I/O DB, Celery) est explicite et voulue : les fonctions pures sont testables isolément.

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/api/ibis/modules/xai/routes.py` | Endpoints FastAPI XAI (explications, test-instances, fairness, chat) ; ExplanationResults expose text_blocks ; getSuggestedQuestions enrichi (top feature humanisée + métrique) | ~286 |
| `apps/api/ibis/modules/xai/service.py` | Création/lecture des entités, débit crédits, dispatch Celery, purge sessions ; NOUVEAU latest_completed_explanation(db, user_id, experiment_id) | ~207 |
| `apps/api/ibis/modules/xai/engine.py` | SHAP global/local, LIME global/local, test-instances, load_experiment_context | ~426 |
| `apps/api/ibis/modules/xai/fairness.py` | compute_group_fairness (pure), fairness_report (wrapper) | ~126 |
| `apps/api/ibis/modules/xai/quality.py` | KPI : shap_completeness, rank_stability, inter_method_agreement, parsimony, lime_fidelity | ~86 |
| `apps/api/ibis/modules/xai/blocks.py` | BlockDocument Pydantic, parse_document, fallback_document (humanisé, Poids %), to_plain_text | ~313 |
| `apps/api/ibis/modules/xai/models.py` | ORM Explanation (+ text_blocks JSONB nullable migration 0009), ChatSession, ChatMessage | ~108 |
| `apps/api/ibis/workers/tasks/explain.py` | _blocks_completion (boucle LLM commune), _fallback_payload (repli commun), _generate_explanation_blocks (explication en blocs), generate_explanation, answer_chat_question | ~503 |
| `apps/api/ibis/modules/llm/xai_text.py` | Helpers humanize_feature/format_share, build_context, prompts explication v2 + chat v2, numbers_exist_in_context, suggested_questions | ~353 |
| `apps/api/alembic/versions/0009_explanation_blocks.py` | Migration : ajout colonne explanations.text_blocks (JSONB nullable) | ~33 |

---

## Schéma BDD

### Table `explanations`

| Colonne | Type | Notes |
|---------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK→users | CASCADE delete |
| `experiment_id` | UUID FK→experiments | CASCADE delete, indexé |
| `type` | ENUM(global/local) | `explanation_type` |
| `method_requested` | VARCHAR(20) | auto/shap/lime |
| `method_used` | VARCHAR(30) | shap_tree/lime — positionné par le worker |
| `method_justification` | VARCHAR(255) | Texte lisible de justification |
| `audience_level` | VARCHAR(20) | novice/intermediate/expert — capturé à la création, immuable |
| `language` | VARCHAR(5) | fr/en |
| `instance_ref` | JSONB | `{"index": N}` pour local, NULL pour global |
| `status` | ENUM(pending/running/completed/failed) | indexé |
| `progress` | SMALLINT | 0→100 |
| `job_id` | UUID | référence vers jobs.id |
| `error_code` | VARCHAR(64) | |
| `error_message` | TEXT | |
| `values` | JSONB | importance/contributions + métadonnées seeds |
| `quality_kpis` | JSONB | KPI calculés ou absents (jamais de valeur fictive) |
| `viz_data` | JSONB | beeswarm, waterfall, method_comparison |
| `text_blocks` | JSONB nullable | BlockDocument sérialisé (évolution §2, migration 0009) — rendu par le frontend |
| `text_explanation` | TEXT | miroir texte de text_blocks via to_plain_text() ; repli rétrocompatible (LLM ou fallback) |
| `model_used` | VARCHAR(120) | identifiant modèle LLM ou "fallback" |
| `is_fallback` | BOOL | true si pas de clé LLM ou après 2 échecs |
| `tokens_used` | INT | 0 si fallback |
| `processing_seconds` | FLOAT | mesuré (`time.perf_counter()`), pas hardcodé |
| `created_at`, `updated_at` | TIMESTAMP | Timestamped mixin |

### Table `chat_sessions`

| Colonne | Type | Notes |
|---------|------|-------|
| `id` | UUID PK | |
| `explanation_id` | UUID FK→explanations | CASCADE delete, indexé |
| `user_id` | UUID | indexé |
| `language` | VARCHAR(5) | |
| `questions_count` | INT | compteur incrémenté à chaque question |
| `max_questions` | INT | copié depuis `settings.max_chat_questions` à la création |
| `is_active` | BOOL | false après expiration (purge_expired_chat_sessions) |
| `last_activity` | TIMESTAMP | mise à jour à chaque question |

### Table `chat_messages`

| Colonne | Type | Notes |
|---------|------|-------|
| `id` | UUID PK | |
| `session_id` | UUID FK→chat_sessions | CASCADE delete, indexé |
| `role` | VARCHAR(10) | user/assistant |
| `content` | TEXT | miroir texte (accessibilité, recherche, repli) |
| `blocks` | JSONB | document BlockDocument sérialisé (réponses assistant v2) |
| `model_used` | VARCHAR(120) | |
| `is_fallback` | BOOL | |
| `tokens_used` | INT | |
| `response_seconds` | FLOAT | temps de réponse mesuré côté worker |
| `created_at` | TIMESTAMP | `server_default="now()"` |

---

## API / Endpoints

| Méthode | Route | Description | Auth | Queue |
|---------|-------|-------------|------|-------|
| `POST` | `/experiments/{id}/explanations` | Demande une explication (global ou local) | user | xai |
| `GET` | `/experiments/{id}/explanations` | Liste les explications d'une expérience | user | — |
| `GET` | `/explanations/{id}` | Détail d'une explication (statut, progression) | user | — |
| `GET` | `/explanations/{id}/results` | Résultats complets (uniquement si `completed`) | user | — |
| `GET` | `/experiments/{id}/test-instances` | Instances de test paginées, triées par erreur | user | — |
| `GET` | `/experiments/{id}/fairness` | Rapport d'équité par colonne sensible | user | — |
| `GET` | `/experiments/{id}/suggested-questions` | Questions suggérées pour le chat | user | — |
| `POST` | `/explanations/{id}/chat` | Crée une session de chat | user | — |
| `POST` | `/chat/{session_id}/messages` | Pose une question (dispatch async) | user | llm |
| `GET` | `/chat/{session_id}/messages` | Liste les messages de la session | user | — |

Tous les endpoints nécessitent une authentification JWT (`CurrentUser` ou `CurrentClaims`).

---

## Schéma des structures de données XAI (JSONB)

### `values` — explication globale SHAP

```json
{
  "importance": [{"feature": "age", "value": 0.123}],
  "ranking": ["age", "income", ...],
  "metadata": {
    "random_state": 42,
    "sample_size": 100,
    "multiclass_policy": "mean_abs",
    "stability_seeds": [42, 43, 44, 45, 46]
  }
}
```

### `viz_data` — explication globale SHAP

```json
{
  "global_importance": [...],
  "beeswarm": [
    {"feature": "age", "points": [{"shap": 0.05, "fv": 0.73}]}
  ],
  "method_comparison": {
    "shap": [...],
    "lime": [...]
  }
}
```

### BlockDocument (chat v2) — structure Pydantic

```
BlockDocument
  schema_version: 1
  blocks: list[Block] (1–16)
    ParagraphBlock   — text (1–1200 chars)
    HeadingBlock     — text (1–160 chars), level (3|4)
    ListBlock        — items (1–12), ordered bool
    TableBlock       — columns (1–5), rows (1–14 × Cell)
    CalloutBlock     — tone, title?, text (1–800 chars)
    KeyValueBlock    — items (1–8 × KeyValueItem)
    FeatureImpactBlock — items (1–10 × FeatureImpactItem)

Tone = "neutral" | "accent" | "positive" | "negative" | "warning"
```

---

## Patterns identifiés

- **Pure functions + side-effect layer** : `engine.py`, `fairness.py`, `quality.py`, `blocks.py` sont des fonctions pures sans I/O DB. Toutes les opérations DB se font dans `service.py` et `workers/tasks/explain.py`.
- **Discriminated union (Pydantic v2)** : `BlockDocument` utilise `Field(discriminator="type")` pour le dispatching polymorphique des blocs.
- **Extra="ignore" sur les blocs** : les modèles `_Block` utilisent `ConfigDict(extra="ignore")` pour absorber les champs superflu d'une réponse LLM sans erreur.
- **Two-pass anti-hallucination (boucle factorisée)** : `_blocks_completion` est la boucle LLM commune (2 tentatives) partagée par `_generate_explanation_blocks` et `_answer_chat_blocks`. Sur échec, `_fallback_payload` fournit le repli commun (`blocks.fallback_document` adapté par audience).
- **Double miroir text_blocks + text_explanation** : `Explanation.text_blocks` stocke le `BlockDocument` sérialisé pour le rendu frontend ; `text_explanation` en est le miroir texte (`to_plain_text`) — accessibilité, repli rétrocompatible, recherche. Même convention que `ChatMessage.content / blocks`.
- **Mirroring texte + blocs (chat)** : `ChatMessage.content` est toujours le miroir texte de `blocks` via `to_plain_text()` — accessibilité, recherche, et repli pour clients sans rendu blocs.
- **fallback_document humanisé** : `blocks.fallback_document` importe `humanize_feature` / `format_share` de `llm.xai_text` pour afficher les noms de variables lisibles et les poids en pourcentage (colonne « Poids (%) ») — même formatage que le contexte LLM.
- **getSuggestedQuestions enrichi** : la route `/suggested-questions` appelle `service.latest_completed_explanation` pour extraire la variable dominante humanisée et la métrique principale, puis les passe à `xai_text.suggested_questions` — les questions citent les vraies valeurs calculées.

---

## Configuration identifiée

- `RANDOM_STATE = 42` — constante module dans `engine.py`
- `GLOBAL_SAMPLE = 100` — échantillon max pour SHAP global
- `LIME_GLOBAL_LOCALS = 50` — nombre d'explications locales agrégées pour LIME global
- `LIME_NUM_FEATURES = 10` — nombre de features LIME par explication
- `LIME_NUM_SAMPLES = 1000` — nombre de samples LIME (transmis réellement, pas tronqué)
- `STABILITY_SEEDS = (42, 43, 44, 45, 46)` — 5 seeds pour la stabilité Spearman
- `TOP_DISPLAY = 15` — top features affichées
- `MAX_GROUPS = 12` — limite groupes pour l'analyse d'équité (colonnes continues)
- `COMPLETENESS_TOLERANCE = 0.01` — seuil axiome d'efficience SHAP (1 %)
- `PARSIMONY_THRESHOLD = 0.8` — seuil parcimonie (80 %)
- `max_chat_questions` — depuis `settings` (variable d'env)
- `chat_session_timeout_hours` — depuis `settings` (variable d'env)
- Timeout worker : `soft_time_limit=1800`, `time_limit=1900` sur `generate_explanation`

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `tests/unit/test_xai_quality.py` | Fonctions pures quality.py (complétude, stabilité, parcimonie, fidélité, accord) | Existant (~96 lignes) |
| `tests/unit/test_xai_blocks.py` | parse_document, fallback_document (humanisation noms, format %, table Poids %), to_plain_text, strip_fences | Existant (~377 lignes) |
| `tests/unit/test_xai_text.py` | humanize_feature, format_share, build_context %, numbers_exist_in_context ÷100, explanation_system_v2/prompt_v2, suggested_questions contextualisées | Existant (~279 lignes) |
| `tests/unit/test_fairness.py` | compute_group_fairness (binaire + multiclasse + edge cases) | Existant |
| `tests/integration/test_xai_api.py` | Endpoints HTTP (avec DB de test, modèle réel) — +28 lignes pour text_blocks et suggested-questions enrichies | Existant |
| Tests worker `generate_explanation` | Couverture worker Celery directe | Absent |

---

## Décisions documentées ici (hors ADR)

- **Sélection SHAP vs LIME** : `hasattr(model, "tree_") or hasattr(model, "estimators_")` — heuristic duck-typing. Les modèles scikit-learn à base d'arbres exposent ces attributs. Non extensible si un futur algo n'expose pas ces attributs.

- **SHAP multiclasse** : deux cas sont gérés (`isinstance(raw, list)` et `raw.ndim == 3`) selon la version de SHAP retournée par TreeExplainer. La politique `mean_abs` est tracée dans les métadonnées.

- **instance_ref stocké en JSONB** : `{"index": N}` pour permettre des évolutions futures (ex : filtres, sous-population) sans migration de schéma.

- **Chat dispatché sur queue `llm`** (pas `xai`) : les questions de chat consomment des tokens LLM, pas du calcul SHAP/LIME. La séparation des queues permet un scaling indépendant.

- **`content` (miroir texte) toujours présent** : le champ `ChatMessage.content` est le résultat de `to_plain_text(doc)` même quand `blocks` est renseigné. Cela sert d'accessibilité, de repli pour les clients anciens, et de base pour la recherche textuelle.

- **`extra="forbid"` sur les payloads d'entrée (routes)** : `ExplanationRequest`, `ChatAsk`, `ChatSessionCreate` ont `model_config = ConfigDict(extra="forbid")` — le contrat d'entrée est strict. En revanche les blocs de sortie LLM ont `extra="ignore"` — le contrat de sortie LLM est tolérant.
