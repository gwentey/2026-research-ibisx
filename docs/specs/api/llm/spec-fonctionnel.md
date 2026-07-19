# Spec Fonctionnelle — api/llm [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | api/llm             |
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

---

## Contexte et objectif

Le module `api/llm` est la couche d'intégration LLM d'IBIS-X. Il fournit un point d'accès unique
et unifié vers OpenRouter pour toutes les fonctions de génération de texte de la plateforme :
explications XAI textuelles, guides de datasets, et réponses de chat XAI. La plateforme reste
100 % fonctionnelle sans clé LLM grâce à des fallbacks déterministes sur chaque usage.

Ce module n'expose aucun endpoint HTTP propre. Il est exclusivement consommé par les workers
Celery (`explain.py`, `guide.py`) et les routes XAI (questions suggérées).

---

## Règles métier (déduites du code)

1. **Fournisseur unique** : tout appel LLM passe par OpenRouter exclusivement. Aucun autre
   fournisseur n'est appelé directement dans le code (cf. commentaire `[NE PAS REPRODUIRE]`
   dans `client.py`).

2. **Fallback obligatoire sur chaque usage** : si le client lève `LLMUnavailable` (clé absente,
   erreur réseau, quota, réponse invalide ou vide), l'appelant doit fournir un texte déterministe
   construit sur les vraies données, signalé par `is_fallback: true` dans la réponse. Aucun texte
   inventé n'est jamais renvoyé.

3. **Contexte limité aux valeurs réelles (anti-hallucination)** : les prompts injectent uniquement
   les métriques calculées, les importances SHAP/LIME, le nom de l'algorithme et du type de tâche.
   Aucune valeur fictive ou déduite ne figure dans le contexte.

4. **Post-validation des nombres** : pour les explications XAI et les réponses de chat, chaque
   nombre cité dans la sortie du LLM est vérifié contre les nombres présents dans le contexte
   (tolérances : arrondis sur 0 à 4 décimales, équivalents pourcentage). Si un nombre absent est
   détecté, le LLM est relancé une fois avant de basculer en fallback.

5. **Génération adaptative par niveau d'audience** : les prompts, les textes de fallback et les
   questions suggérées sont produits en trois formulations distinctes selon le niveau d'audience
   (`novice` / `intermediate` / `expert`) :
   - Novice : analogie du quotidien, langage courant, maximum 3 variables citées, ~180 mots.
   - Intermediate : structuré, orienté décision, maximum 5 variables, ~250 mots.
   - Expert : terminologie exacte (axiomes SHAP, OOB, macro-métriques), ~320 mots.

6. **Bilingue** : les prompts système, les instructions utilisateur et les textes de fallback
   existent en français et en anglais. La langue est passée à chaque point d'appel.

7. **Transparence du fallback** : les textes de fallback contiennent explicitement la mention
   « Ce résumé a été généré sans IA, uniquement à partir des valeurs calculées. » (FR) ou
   « This summary was generated without AI, from the computed values only. » (EN).

8. **Guide de dataset** : le guide IA d'un dataset est généré à partir des métadonnées réelles
   (nom, objectif, domaines, tâches, lignes/colonnes, pourcentage de valeurs manquantes, colonnes
   avec exemples et marqueurs PII). Il est structuré en 4 sections imposées. En fallback, le guide
   est construit à partir des mêmes métadonnées sans faire appel au LLM.

9. **Questions suggérées déterministes** : les 4 questions suggérées pour le chat XAI sont
   produites localement (aucun appel LLM) en fonction du type de tâche ML
   (`classification` / régression) et du niveau d'audience.

10. **Chat XAI v2 en blocs JSON** : les réponses du chat sont demandées en mode JSON strict
    (`json_mode: true`) et doivent être conformes au schéma `BlockDocument` (validé en Pydantic
    côté worker). Jusqu'à 2 tentatives sont effectuées avant basculement en fallback structuré.

---

## Cas d'usage (déduits)

### CU-001 — Génération d'explication XAI textuelle

L'utilisateur demande une explication d'un modèle (globale ou locale). Le worker XAI appelle
`xai_text.build_context()` pour construire le contexte à partir des métriques et importances
réelles, puis `xai_text.build_prompt()` pour produire le prompt adapté au niveau d'audience et
à la langue. `llm_client.complete()` est appelé, et la sortie est validée par
`xai_text.numbers_exist_in_context()`. Si la validation échoue, le LLM est relancé une fois.
En cas d'échec (LLMUnavailable ou deux validations échouées), `xai_text.fallback_text()` produit
un texte déterministe adapté au niveau, badgé « sans IA ».

### CU-002 — Génération du guide IA d'un dataset

L'utilisateur demande la génération du guide IA d'un dataset depuis la fiche de détail. Une tâche
Celery sur la file `llm` appelle `guides.build_prompt()` avec les métadonnées réelles du dataset,
puis `llm_client.complete()`. Si le LLM est indisponible, `guides.fallback_guide()` produit un
guide structuré en 4 sections à partir des mêmes métadonnées, badgé « sans IA ».

### CU-003 — Réponse chat XAI en blocs (v2)

L'utilisateur pose une question dans le copilote XAI. La tâche Celery appelle
`xai_text.chat_system_v2()` (système anti-hallucination + directive de niveau + grammaire JSON)
et `xai_text.chat_prompt_v2()` (contexte + historique + question + ton). Le LLM est appelé avec
`json_mode=True` et `max_tokens=700`. La sortie est parsée par `xai_blocks.parse_document()` et
validée numériquement. En cas d'échec, `xai_blocks.fallback_document()` produit un document
structuré déterministe.

### CU-004 — Questions suggérées pour le chat XAI

Le frontend demande des questions suggérées pour un experiment. L'endpoint
`/experiments/{id}/suggested-questions` appelle directement `xai_text.suggested_questions()`
(aucun LLM). Retourne 4 questions dépendant du type de tâche ML et du niveau d'audience.

---

## Dépendances

- `ibis.core.config` — `get_settings()` pour lire `OPENROUTER_API_KEY`, `LLM_MODEL`,
  `LLM_MAX_TOKENS`, `LLM_TIMEOUT_SECONDS`.
- `ibis.modules.datasets.models.Dataset` — pour `guides.py` (accès aux métadonnées de dataset).
- `ibis.modules.xai.blocks` — pour la validation `BlockDocument` des réponses chat v2 (consommé
  par `explain.py`).
- `httpx` — client HTTP synchrone pour l'appel OpenRouter.
- Consommé par : `ibis.workers.tasks.explain`, `ibis.workers.tasks.guide`,
  `ibis.modules.xai.routes` (questions suggérées).

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- Le seuil de crédits (1 crédit = 1 explication LLM, documenté en commentaire
  `CDC §3.3` dans `xai/service.py`) est géré côté XAI, pas LLM — la frontière de
  responsabilité entre les deux modules mériterait clarification.
- La règle exacte de tolérance des arrondis dans `numbers_exist_in_context` (4 décimales +
  équivalents %) n'est pas documentée comme exigence métier ; elle semble issue d'un calibrage
  pratique.
- Le seuil de 2 tentatives avant fallback (pour l'explication XAI et le chat v2) est codé en dur
  — il n'est pas exposé en configuration.
- La limite de 10 échanges dans l'historique du chat (`history[-10:]`) et la limite de 120 mots
  en réponse de chat v1 ne sont pas documentées comme contraintes métier explicites.
