# Spec Technique — api/llm

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | api/llm             |
| Version       | 0.2.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie + évolutions XAI §1/§3/§4 |

---

## Architecture du module

Le module `api/llm` est organisé en trois fichiers fonctionnellement distincts :

- **`client.py`** — Couche transport vers OpenRouter. Aucune logique métier. Soulève
  `LLMUnavailable` sur tout échec. Retourne un `LLMResult` (text, model_used, tokens_used,
  is_fallback).
- **`xai_text.py`** — Logique de prompt XAI : helpers de formatage lisible
  (`humanize_feature`, `format_share`, `_round3`, `_importance_line`), construction du
  contexte (`build_context` — métriques et importances en %, valeurs locales arrondies 3 déc.),
  génération des prompts adaptatifs pour le chat (`chat_system_v2`, `chat_prompt_v2`) et pour
  les explications en blocs (`explanation_system_v2`, `explanation_prompt_v2`),
  post-validation anti-hallucination (`numbers_exist_in_context` — tolère 24 ↔ 0.24),
  questions suggérées contextualisées (`suggested_questions` — cite la vraie variable
  dominante et la vraie métrique). `build_prompt` et `fallback_text` (chemin texte plat)
  ont été supprimés ; le repli est désormais `blocks.fallback_document`.
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
| `apps/api/ibis/modules/llm/xai_text.py` | Helpers formatage lisible (humanize_feature, format_share), build_context, prompts adaptatifs chat v2 + explication v2, numbers_exist_in_context, suggested_questions | ~353 |
| `apps/api/ibis/modules/llm/guides.py` | Prompts guide dataset, fallback guide, payload de réponse | ~146 |
| `apps/api/ibis/workers/tasks/explain.py` | Worker XAI : _blocks_completion factorisé, _generate_explanation_blocks, generate_explanation, answer_chat_question | ~503 |
| `apps/api/ibis/workers/tasks/guide.py` | Worker guide dataset : appelle guides + llm_client | ~60 |
| `apps/api/ibis/modules/xai/routes.py` | Route `/suggested-questions` : appelle directement xai_text.suggested_questions | ~270 |
| `apps/api/ibis/core/config.py` | Paramètres LLM : openrouter_api_key, llm_model, llm_max_tokens, llm_timeout_seconds | ~80 |
| `apps/api/tests/unit/test_xai_text.py` | Tests unitaires de xai_text (humanize_feature, format_share, build_context %, numbers_exist_in_context ÷100, explanation_system_v2, explanation_prompt_v2, suggested_questions contextualisées) | ~279 |

---

## Schéma BDD

Le module `api/llm` n'a pas de table propre. Il écrit indirectement via les workers :

- `datasets.ai_guide` (JSONB) — champ sur la table `datasets`, peuplé par le worker `guide.py`
  avec le payload `{ text, model_used, is_fallback, language, tokens_used, generated_at }`.
- `explanations.text_explanation` (TEXT), `explanations.text_blocks` (JSONB, depuis migration 0009),
  `explanations.model_used` (VARCHAR), `explanations.is_fallback` (BOOLEAN) — peuplés par le
  worker `explain.py`. `text_blocks` contient le `BlockDocument` sérialisé ;
  `text_explanation` en est le miroir texte (`to_plain_text`).
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

1. **Au prompt** : le contexte ne contient que les vraies valeurs numériques calculées (importances
   en %, valeurs locales arrondies 3 déc.). La consigne « cite les nombres tels qu'affichés » est
   injectée dans `chat_prompt_v2` et `explanation_prompt_v2`.
2. **Post-génération** : `numbers_exist_in_context()` scanne la sortie et compare chaque nombre à
   l'ensemble des valeurs du contexte (avec tolérance sur les arrondis 0–4 décimales, les
   équivalents pourcentage, et désormais la tolérance symétrique ÷100 : 24 ↔ 0,24). Les petits
   ordinaux (1, 2, 3, 4, 5, 10, 100) sont tolérés.

### Génération adaptative par niveau (AUDIENCE_SPECS / AUDIENCE_CHAT_TONE)

Deux dictionnaires `AUDIENCE_SPECS` et `AUDIENCE_CHAT_TONE` mappent `(audience, lang)` vers des
instructions de ton et de longueur. Le niveau `audience` est lu depuis `explanation.audience_level`
(capturé immuablement à la création de l'explication — voir RETRO-002).

Le fallback déterministe pour les explications est désormais `blocks.fallback_document` (adapté par
audience, humanisé) — `fallback_text` (texte plat) a été supprimé.

### Prompts chat v2 et explication v2

- **Chat v2** (`chat_prompt_v2` / `chat_system_v2`) : réponse JSON `BlockDocument`,
  `json_mode=True`, `max_tokens=700`, historique 10 tours. Utilisée par le worker
  `answer_chat_question`.
- **Explication v2** (`explanation_prompt_v2` / `explanation_system_v2`) : même grammaire de blocs
  que le chat, `max_tokens=1400`. Nouvelle (évolution §2) — utilisée par le worker
  `_generate_explanation_blocks`.

Les deux systèmes composent : directive de niveau d'audience + grammaire JSON des blocs (7 types,
5 tonalités sémantiques) + consigne anti-hallucination numérique.

### Helpers de formatage lisible (humanize_feature, format_share)

- `humanize_feature(name)` : `"cat__Sex_female"` → `"Sex = female"`. Dépréfixe les encodages
  sklearn (`cat__`, `num__`), détecte le motif `colonne_valeur` pour les variables catégorielles.
- `format_share(value, total)` : produit `"24 %"`, `"<1 %"`, demi-parts arrondies vers le haut.
- `_importance_line(feature, value, total)` : formate une ligne d'importance en « part de
  l'importance affichée » avec flèches ↗/↘ pour les contributions locales signées.

### Questions suggérées contextualisées

`suggested_questions(task_type, language, audience, *, top_feature=None, metric_name=None,
metric_value=None)` génère des questions templatisées qui citent la vraie variable dominante et la
vraie métrique. En l'absence de contexte (`top_feature=None`), un jeu de questions génériques est
retourné.

### Boucle de régénération (2 tentatives max)

Pour l'explication XAI et le chat v2, si la sortie du LLM échoue à la validation (nombre absent
du contexte pour XAI, JSON invalide ou nombre halluciné pour le chat), une deuxième tentative est
effectuée avant basculement en fallback. Ce seuil de 2 est codé en dur.

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/api/tests/unit/test_xai_text.py` | `humanize_feature` (cas catégoriels, nettoyage préfixes), `format_share` (arrondi, <1%), `build_context` (importances en %, arrondi 3 déc.), `numbers_exist_in_context` (tolérance ÷100), `explanation_system_v2` (directive audience, grammaire blocs), `explanation_prompt_v2` (variation audience/langue), `suggested_questions` contextualisées (top_feature, metric_name) | Existant (~279 lignes) |
| `apps/api/tests/unit/test_config.py` | Vérifie la présence des paramètres LLM dans les settings | Existant |

Tests absents :
- Tests unitaires de `client.py` (mock httpx)
- Tests unitaires de `guides.py` (fallback_guide, dataset_context)
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
