# Spec Technique — api/llm

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | api/llm             |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

---

## Architecture du module

Le module `api/llm` est organisé en trois fichiers fonctionnellement distincts :

- **`client.py`** — Couche transport vers OpenRouter. Aucune logique métier. Soulève
  `LLMUnavailable` sur tout échec. Retourne un `LLMResult` (text, model_used, tokens_used,
  is_fallback).
- **`xai_text.py`** — Logique de prompt XAI : construction du contexte (`build_context`),
  génération des prompts adaptatifs (`build_prompt`, `chat_system_v2`, `chat_prompt_v2`),
  fallbacks déterministes (`fallback_text`), post-validation anti-hallucination
  (`numbers_exist_in_context`), questions suggérées (`suggested_questions`).
- **`guides.py`** — Logique de prompt pour les guides de datasets : construction du contexte
  (`dataset_context`), prompt guide (`build_prompt`), fallback déterministe (`fallback_guide`),
  payload de réponse (`guide_payload`).

Le module ne contient pas de routes FastAPI, ni de modèles SQLAlchemy. Il est exclusivement
consommé par des workers Celery et une route XAI.

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/api/ibis/modules/llm/client.py` | Client HTTP synchrone OpenRouter, exception LLMUnavailable, dataclass LLMResult | ~88 |
| `apps/api/ibis/modules/llm/xai_text.py` | Prompts XAI adaptatifs, fallback textuel, chat v1/v2, validation anti-hallucination, questions suggérées | ~446 |
| `apps/api/ibis/modules/llm/guides.py` | Prompts guide dataset, fallback guide, payload de réponse | ~146 |
| `apps/api/ibis/workers/tasks/explain.py` | Worker XAI : appelle xai_text + llm_client pour explications et chat | ~300 |
| `apps/api/ibis/workers/tasks/guide.py` | Worker guide dataset : appelle guides + llm_client | ~60 |
| `apps/api/ibis/modules/xai/routes.py` | Route `/suggested-questions` : appelle directement xai_text.suggested_questions | ~270 |
| `apps/api/ibis/core/config.py` | Paramètres LLM : openrouter_api_key, llm_model, llm_max_tokens, llm_timeout_seconds | ~80 |
| `apps/api/tests/unit/test_xai_text.py` | Tests unitaires de xai_text (adaptatif, fallback, chat v2, questions suggérées) | ~76 |

---

## Schéma BDD

Le module `api/llm` n'a pas de table propre. Il écrit indirectement via les workers :

- `datasets.ai_guide` (JSONB) — champ sur la table `datasets`, peuplé par le worker `guide.py`
  avec le payload `{ text, model_used, is_fallback, language, tokens_used, generated_at }`.
- `explanations.text_explanation` (TEXT), `explanations.model_used` (VARCHAR),
  `explanations.is_fallback` (BOOLEAN) — peuplés par le worker `explain.py`.
- `chat_messages.content` (TEXT), `chat_messages.blocks` (JSONB), `chat_messages.model_used`,
  `chat_messages.is_fallback` — peuplés par le worker `explain.py` (réponses chat v2).

---

## API / Endpoints

Le module `api/llm` n'expose pas d'endpoints HTTP propres. Il est consommé indirectement via :

| Méthode | Route | Description | Via |
|---------|-------|-------------|-----|
| `POST` | `/datasets/{id}/ai-guide` | Lance la tâche Celery de génération du guide (file `llm`) | `datasets/routes.py` |
| `GET` | `/experiments/{id}/suggested-questions` | Questions suggérées déterministes | `xai/routes.py` directement |
| `POST` | `/chat/{session_id}/messages` | Lance la tâche Celery de réponse chat (file `llm`) | `xai/routes.py` |

---

## Configuration (variables d'environnement)

| Variable | Défaut | Description |
|----------|--------|-------------|
| `OPENROUTER_API_KEY` | `""` (vide = fallback activé) | Clé d'accès OpenRouter |
| `LLM_MODEL` | `openai/gpt-5-mini` | Identifiant du modèle piloté par env |
| `LLM_MAX_TOKENS` | `2000` | Limite de tokens de sortie par défaut |
| `LLM_TIMEOUT_SECONDS` | `60` | Délai d'attente réseau |

---

## Patterns identifiés

### Pattern gateway unique (single-client)

`client.py` est le seul point d'appel réseau vers un LLM. L'invariant est documenté par le
commentaire `[NE PAS REPRODUIRE] les 3 services LLM divergents de la v1`. Toute la logique de
prompt est dans les modules `xai_text.py` et `guides.py` ; `client.py` ne connaît que le transport.

### Pattern fallback obligatoire (Principle 2)

Chaque appelant de `llm_client.complete()` enveloppe l'appel dans un `try/except LLMUnavailable`
et possède un chemin de fallback déterministe. La règle est explicitement documentée dans le
docstring de `client.py` : « l'appelant DOIT avoir un fallback déterministe marqué
`is_fallback: true` (P2). Jamais de sortie inventée. »

### Prompts comme fonctions pures

`xai_text.py` et `guides.py` n'ont aucun accès à la base de données ni à la configuration. Ils
reçoivent les données en paramètre et retournent des chaînes. Cela les rend testables sans
infrastructure.

### Anti-hallucination en deux couches

1. **Au prompt** : le contexte ne contient que les vraies valeurs numériques calculées.
2. **Post-génération** : `numbers_exist_in_context()` scanne la sortie et compare chaque nombre à
   l'ensemble des valeurs du contexte (avec tolérance sur les arrondis 0–4 décimales et les
   équivalents pourcentage). Les petits ordinaux (1, 2, 3, 4, 5, 10, 100) sont tolérés.

### Génération adaptative par niveau (AUDIENCE_SPECS / AUDIENCE_CHAT_TONE)

Deux dictionnaires `AUDIENCE_SPECS` et `AUDIENCE_CHAT_TONE` mappent `(audience, lang)` vers des
instructions de ton et de longueur. Le niveau `audience` est lu depuis `explanation.audience_level`
(capturé immuablement à la création de l'explication — voir RETRO-002).

Le fallback `fallback_text()` implémente 3 formulations distinctes :
- Novice : analogie fruit + 3 variables max + badge "sans IA"
- Intermediate : structure décision + 5 variables + badge
- Expert : terminologie exacte + 5 variables + badge

### Chat v1 vs chat v2

- **v1** (`chat_prompt` / `chat_system`) : réponse texte libre, limite 120 mots, historique
  10 tours. Toujours présente dans le code mais non utilisée par le worker actuel.
- **v2** (`chat_prompt_v2` / `chat_system_v2`) : réponse JSON `BlockDocument`, `json_mode=True`,
  `max_tokens=700`, même limite historique 10 tours. Utilisée par le worker `answer_chat_question`.

Le système v2 compose : prompt anti-hallucination + directive de niveau d'audience + grammaire JSON
des blocs (7 types, 5 tonalités sémantiques). La grammaire est injectée en clair dans le prompt
système pour guider le modèle vers un JSON strict.

### Boucle de régénération (2 tentatives max)

Pour l'explication XAI et le chat v2, si la sortie du LLM échoue à la validation (nombre absent
du contexte pour XAI, JSON invalide ou nombre halluciné pour le chat), une deuxième tentative est
effectuée avant basculement en fallback. Ce seuil de 2 est codé en dur.

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/api/tests/unit/test_xai_text.py` | fallback_text varie par audience et cite les vraies valeurs ; novice cite ≤ 3 variables ; chat_system_v2 injecte la directive de niveau et la grammaire ; chat_prompt_v2 varie par audience ; suggested_questions retourne 4 questions et varie par niveau | Existant |
| `apps/api/tests/unit/test_config.py` | Vérifie la présence des paramètres LLM dans les settings | Existant |

Tests absents :
- Tests unitaires de `client.py` (mock httpx)
- Tests unitaires de `guides.py` (fallback_guide, dataset_context)
- Tests de `numbers_exist_in_context` en isolation (couverture des arrondis et des ordinaux tolérés)
- Tests d'intégration du worker `guide.py` (flow complet LLM + fallback)

---

## Décisions non-architecturales documentées ici

Les décisions suivantes ont été identifiées comme candidates ADR mais rejetées (voir rapport
ADR ci-dessous) — elles sont documentées ici pour traçabilité.

### Température 0 systématique

`client.py` passe `temperature=0.0` par défaut sur tous les appels. L'intention est la
reproductibilité des sorties (P4). Cette valeur est également appliquée aux guides (`guides.py`)
et aux explications (`xai_text.py`). Elle peut être surchargée par les appelants mais aucun ne
le fait actuellement.

Rejet ADR : AP-2 (configuration d'outil).

### Seuil 2 tentatives avant fallback

Le code tente jusqu'à 2 fois la génération LLM (boucle `for _attempt in range(2)`) avant de
basculer en fallback. Ce seuil est codé en dur. Il s'applique indépendamment pour les explications
XAI (validation numérique) et le chat v2 (validation JSON + numérique).

Rejet ADR : AP-3 (heuristique d'implémentation).

### Limite de 10 tours d'historique dans les prompts chat

`history[-10:]` — seuls les 10 derniers échanges sont injectés dans le prompt. Raison probable :
limitation de la fenêtre de contexte et du coût en tokens. Non configurable.

Rejet ADR : AP-3 (heuristique d'implémentation).

### Ordinaux tolérés dans la post-validation numérique

Les valeurs `1, 2, 3, 4, 5, 10, 100` sont exclues de la vérification anti-hallucination car elles
correspondent à des ordinaux courants (« 3 variables », « 2 essais »). Cette liste est codée en
dur dans `numbers_exist_in_context`.

Rejet ADR : AP-3 (heuristique d'implémentation).

### Décisions couvertes par des ADRs existants

- OpenRouter comme fournisseur exclusif, fallback `is_fallback: true` obligatoire, température 0 :
  couverts par **ADR-006** (`docs/adr/ADR-006-ia-xai-llm.md`).
- Audience level capturé immuablement par explication, override éphémère sans mutation du profil :
  couverts par **RETRO-002** (`docs/adr/RETRO-002.md`).
- Contrat BlockDocument (7 types de blocs, 5 tonalités sémantiques, extra="ignore") :
  couvert par **RETRO-012** (`docs/adr/RETRO-012.md`).
