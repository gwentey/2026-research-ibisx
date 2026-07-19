# CDC — Évolutions XAI (IBIS-X)

**Date :** 2026-07-19 · **Périmètre :** feature Explicabilité (explication + copilote chat).
**Objectif :** rendre l'explication et le copilote réellement utiles à un novice, unifier
le design (blocs riches), fiabiliser le lien profil ↔ explication, et contextualiser les
questions suggérées.

> Ce document est le **cahier des charges de référence**. Le fichier voisin
> [`PROMPT-nouvelle-session.md`](./PROMPT-nouvelle-session.md) est le prompt autoportant à
> coller dans une **nouvelle session** Claude Code pour l'exécuter.

---

## 0. État actuel (ce qui existe déjà — ne PAS reconstruire)

Feature XAI = deux chemins qui partagent le même sous-système :

| Élément | Fichier | État |
|---|---|---|
| **Rendu blocs riches** (tableaux, callouts, couleurs, featureImpact) | `apps/web/components/ibis/xai/ibis-blocks.tsx` + `apps/web/lib/xai/blocks.ts` | ✅ existe — **utilisé UNIQUEMENT par le chat** |
| **Schéma de blocs backend** | `apps/api/ibis/modules/xai/blocks.py` (`BlockDocument`, `parse_document`, `fallback_document`) | ✅ existe |
| **Génération chat (blocs)** | `apps/api/ibis/workers/tasks/explain.py` → `_answer_chat_blocks()` | ✅ blocs + anti-hallucination + fallback |
| **Génération explication (texte)** | `explain.py` → `_generate_text()` | ⚠️ **texte plat (markdown)**, pas de blocs |
| **Affichage explication** | `apps/web/components/ibis/xai/explanation-view.tsx` (composant `Markdown`) | ⚠️ texte plat |
| **Prompts + contexte + anti-hallucination + fallback texte** | `apps/api/ibis/modules/llm/xai_text.py` | `build_context`, `build_prompt`, `numbers_exist_in_context`, `fallback_text`, `chat_system_v2`, `chat_prompt_v2`, `suggested_questions`, `AUDIENCE_SPECS` |
| **Client LLM** | `apps/api/ibis/modules/llm/client.py` | `complete(system, user, max_tokens, json_mode)` ; supporte `reasoning.effort` (voir §Acquis) |
| **Switch de profil « Voir en tant que »** | `apps/web/components/ibis/audience/audience-switcher.tsx` + `apps/web/app/(app)/experiments/[id]/page.tsx` | ✅ ; override éphémère (`effectiveAudience`), ne modifie jamais le profil |
| **Régénération à un autre niveau** | `explanation-view.tsx` (`canRegenerate` → « Regénérer en vue X (1 crédit) ») + `xai-tab.tsx` (`regenerate()`) | ⚠️ **existe déjà mais peu visible** |
| **Copilote chat** | `apps/web/components/ibis/xai/explanation-copilot.tsx` | quota « N questions restantes », suggestions, rendu via `IbisBlocks` |
| **Questions suggérées** | route `getSuggestedQuestions` → `xai_text.suggested_questions(task_type, language, audience)` | ⚠️ **listes génériques codées en dur** |
| **Crédits** | débit serveur dans `apps/api/ibis/modules/xai/service.py` → `request_explanation` (`user.credits -= 1`) ; le front réconcilie via `getMe()` | ✅ |
| **Routes XAI** | `apps/api/ibis/modules/xai/routes.py` | voir §Annexe routes |
| **Profil (adaptatif)** | `user.xai_audience` (enum `XaiAudience`) → `audience_level` sur l'explication → `AUDIENCE_SPECS` / `chat_*_v2` | ✅ le niveau pilote longueur + ton |

**Types de blocs disponibles** (schéma `blocks.py`, tone = `neutral|accent|positive|negative|warning`) :
`paragraph`, `heading` (level 3/4), `list` (ordered), `table` (≤5 col, ≤14 lignes, cellules tonées),
`callout` (tone + titre), `keyValue` (≤8 paires tonées), `featureImpact` (≤10 barres up/down).

---

## Acquis de la mise en prod (à respecter absolument)

1. **gpt-5-mini est un modèle à raisonnement.** En prod, `.env` : `LLM_MODEL=openai/gpt-5-mini`,
   `LLM_REASONING_EFFORT=low`, `LLM_MAX_TOKENS=3000`. Le client (`client.py`) envoie
   `reasoning.effort`, **retire `temperature`** et **relève `max_tokens`** quand l'effort est
   défini. NE PAS casser ce chemin. Sans ça : `content=null` → repli.
2. **Garde-fou anti-hallucination** (`xai_text.numbers_exist_in_context`) : tolère les
   arrondis (0–4 déc.), les %, **la valeur exacte du contexte** (`f"{value:g}"`, corrigé
   pendant la mise en prod) et les petits ordinaux. Il **loggue** les nombres rejetés
   (`xai_text.foreign_numbers`). Toute évolution qui touche les nombres du contexte doit
   garder ce garde-fou **vert**.
3. **Bug masqué en dev.** Sans clé LLM en dev, tout tombe en fallback → les chemins LLM réels
   ne sont jamais exercés par les tests unitaires (qui mockent `complete`). Écrire des tests
   qui **exercent la logique** (validation des blocs, arrondi, garde-fou) sans dépendre d'une
   vraie clé.
4. **Worker Celery ne recharge PAS à chaud** ; **migrations Alembic au boot de l'api**.

---

## Principes transverses (s'appliquent aux 4 évolutions)

- **FR/EN** : toute chaîne visible passe par i18n (`apps/web/messages/{fr,en}.json`).
- **Design riche** : composer avec les tokens du kit (jamais de primitives nues) ; le motif
  IA unifié (couleur `ai`, blocs) doit être identique entre explication et chat.
- **Adaptatif** : tout contenu généré est fonction de `audience_level` (novice/intermediate/expert).
- **Anti-hallucination** : conservé partout où un LLM produit des nombres.
- **Contrat OpenAPI (ADR-007)** : après toute modif de route/schéma backend →
  `cd apps/api && uv run python -m ibis.export_openapi ../web/lib/api/openapi.json` puis
  `cd apps/web && pnpm generate:api`, et **commiter** le client généré (la CI le vérifie).
- **TDD** : test qui échoue d'abord, puis implémentation.

---

## Évolution 1 — Nombres lisibles (TRANSVERSE — à faire en premier)

**Objectif.** Le modèle recopie aujourd'hui les importances SHAP en pleine précision
(`0.242421`) dans l'explication ET le chat → illisible pour un novice. On veut des nombres
**humanisés** (« ≈ 24 % », « 0,24 ») partout.

**Comportement actuel.** `xai_text.build_context(...)` (et le contexte du chat) injecte les
valeurs brutes float. Le modèle les recopie fidèlement (le garde-fou les tolère depuis le
correctif prod). Résultat : `cat__Sex_female = 0.242421` dans le texte.

**Comportement cible.**
- Les importances sont présentées **en pourcentage de l'importance totale** (ou arrondies à
  2–3 chiffres significatifs) dans le contexte donné au LLM.
- Les métriques sont arrondies à 3 décimales max.
- Les **noms de variables** sont humanisés : `cat__Sex_female` → « Sexe = femme »,
  `num_median_0__Pclass` → « Classe (Pclass) », les tickets bruités → regroupés/masqués.
- Le prompt rappelle : « cite les nombres tels qu'affichés (arrondis / en %) ».

**Approche technique.**
- `apps/api/ibis/modules/llm/xai_text.py` : ajouter un helper `humanize_feature(name) -> str`
  et un formatage des nombres dans `build_context` (+ le contexte chat). Recalculer les
  importances en % (somme = 100 % sur le top-N affiché).
- Vérifier que `numbers_exist_in_context` reste vert (il tolère déjà arrondis + %).
- Front : `ibis-blocks.tsx` / `explanation-view.tsx` affichent déjà les poids ; s'assurer
  qu'ils montrent le **même** format arrondi/%.

**Critères d'acceptation.**
- Une explication/chat sur Titanic cite « ≈ 24 % » ou « 0,24 », **jamais** `0.242421`.
- Aucun repli dû à l'hallucination sur ce cas.
- Noms de features lisibles (pas de `cat__…`/`num_median_0__…` bruts côté utilisateur).

**Tests.** `apps/api/tests/unit/test_xai_text.py` : `humanize_feature`, formatage du contexte,
garde-fou vert sur un contexte arrondi ; conserver `test_xai_quality.py`.

---

## Évolution 2 — Explication en blocs riches (comme le chat)

**Objectif.** « Explication rédigée par l'IA » doit avoir le **même design** que le chat :
tableaux, callouts, sections, couleurs, gras.

**Comportement actuel.** `_generate_text()` renvoie du **texte plat** stocké dans
`explanation.text_explanation`, rendu par `Markdown` dans `explanation-view.tsx`. Les blocs
typés n'existent que pour le chat.

**Comportement cible.** L'explication est générée en **BlockDocument** (même schéma que le
chat) et rendue par `IbisBlocks`.

**Approche technique.**
- Backend :
  - Créer `_generate_explanation_blocks(...)` sur le modèle de `_answer_chat_blocks()` :
    `llm_client.complete(json_mode=True)` avec un système « blocs » (réutiliser la grammaire
    de blocs de `xai_text` / `chat_system_v2`), `parse_document`, anti-hallucination, sinon
    `fallback_document(...)` (déjà per-audience). Factoriser un helper commun chat/explication
    si pertinent (éviter la duplication).
  - **Migration Alembic** : ajouter `explanation.text_blocks` (JSON, nullable). Conserver
    `text_explanation` (texte plat) pour compat + le champ `content` miroir.
  - Exposer les blocs dans `ExplanationResults` / `getExplanationResults` (routes.py).
- Front :
  - `explanation-view.tsx` : si `blocks` présents → `<IbisBlocks blocks={...} />`, sinon repli
    `Markdown` (rétrocompat).
- Régénérer le contrat OpenAPI + client TS.

**Critères d'acceptation.**
- La section « Explication rédigée par l'IA » affiche tableaux/callouts/sections comme le chat.
- Repli déterministe toujours fonctionnel (badge « sans IA »).
- Blocs validés (schéma), adaptés au profil.

**Tests.** Backend : génération de blocs explication + fallback (mock `complete`). Front :
rendu `IbisBlocks` quand blocs présents, repli `Markdown` sinon.

---

## Évolution 3 — Explication liée au profil (régénération + crédits + avertissement)

**Objectif.** Rendre **évident** que l'explication affichée est figée au niveau où elle a été
générée, et que changer de profil impose une **régénération** qui **coûte un crédit**.

**Comportement actuel.** Le switch « Voir en tant que » ne régénère pas : un CTA
« Regénérer en vue X (1 crédit) » existe (`canRegenerate` quand
`generatedAudience !== effectiveAudience`) mais **passe inaperçu** → l'utilisateur croit que
rien ne change.

**Comportement cible.**
- Quand `effectiveAudience !== niveau généré`, afficher un **bandeau proéminent** sur
  l'explication : « Cette explication a été rédigée pour le profil **X**. Pour la lire en
  **Y**, il faut la régénérer — cela **coûte 1 crédit** (nouveau calcul). »
- Bouton **Régénérer** avec **confirmation** (dialog) rappelant le coût.
- Après régénération : l'explication passe au niveau Y, 1 crédit débité (déjà côté serveur),
  solde rafraîchi (déjà via `getMe()`), libellé « Niveau : Y » cohérent.
- Le niveau affiché doit **toujours** correspondre au niveau généré.

**Approche technique.** Essentiellement **front** (`explanation-view.tsx`,
`experiments/[id]/page.tsx`, `audience-warning.tsx`) : renforcer le bandeau + dialog de
confirmation + i18n. Backend déjà OK (l'`audience` de la requête gagne, débit serveur).

**Critères d'acceptation.**
- Switch de profil sur une explication existante → bandeau + CTA visibles immédiatement.
- Régénérer produit une explication au nouveau niveau et débite 1 crédit (confirmation avant).
- Impossible de croire qu'on lit un niveau alors qu'un autre est généré.

**Tests.** Front : bandeau visible quand niveaux diffèrent, confirmation avant régénération.

---

## Évolution 4 — Questions suggérées contextualisées

**Objectif.** Les suggestions doivent parler du **vrai** modèle : variable dominante réelle,
métrique réelle, tâche réelle.

**Comportement actuel.** `xai_text.suggested_questions(task_type, language, audience)` renvoie
des listes **génériques codées en dur**.

**Comportement cible.** Questions templatisées avec la **variable la plus importante** (nom
humanisé) et la **métrique principale**, ex. « Pourquoi *le sexe* pèse-t-il autant ? »,
« Un F1 de 0,73, c'est bon ou pas ? ». **Déterministe** (pas de LLM — rapide et gratuit).

**Approche technique.**
- `routes.py` `getSuggestedQuestions` : récupérer la dernière explication de l'expérience →
  top feature(s) + métrique principale, passer à `suggested_questions(...)`.
- `xai_text.suggested_questions(...)` : templatiser avec `humanize_feature` (Évolution 1) et
  la métrique. Garder l'adaptation au profil (novice = langage courant).
- Front : aucun changement (déjà affiché).

**Critères d'acceptation.**
- Les suggestions citent la vraie variable dominante et la vraie métrique.
- Toujours déterministe, adaptées au profil, FR/EN.

**Tests.** `test_xai_text.py` : `suggested_questions` avec un top feature/métrique injectés.

---

## Ordre recommandé & découpage

1. **Évolution 1** (nombres lisibles + `humanize_feature`) — fondation transverse, débloque 2 & 4.
2. **Évolution 4** (questions suggérées) — petite, réutilise `humanize_feature`.
3. **Évolution 2** (explication en blocs) — la plus grosse (back + migration + front + contrat).
4. **Évolution 3** (profil + crédits) — surtout front, renforce l'existant.

Chaque évolution = un lot : test rouge → implémentation → tests/lint/types verts → commit.

---

## Contraintes & conventions

- **Français** partout (code, commits, UI FR/EN).
- **Pas d'attribution Claude** dans les commits/PR (`Co-Authored-By` interdit).
- **TDD** ; garder la CI **verte**.
- **Commandes de vérif :**
  - API : `cd apps/api && uv run ruff check . && uv run ruff format --check . && uv run mypy ibis && uv run pytest -q`
  - Web : `cd apps/web && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
  - Contrat : après modif backend → export OpenAPI + `pnpm generate:api` + commit du client.
- **Ne pas** réintroduire de nombres bruts, ni casser le garde-fou, ni le chemin `reasoning`.

---

## Annexe — routes XAI (`apps/api/ibis/modules/xai/routes.py`)

| Méthode | Route | operationId |
|---|---|---|
| POST | `/experiments/{id}/explanations` | `requestExplanation` (202, 1 crédit) |
| GET | `/experiments/{id}/explanations` | `listExplanations` |
| GET | `/experiments/{id}/test-instances` | `listTestInstances` |
| GET | `/explanations/{id}` | `getExplanation` |
| GET | `/explanations/{id}/results` | `getExplanationResults` (409 si non terminé) |
| GET | `/experiments/{id}/suggested-questions` | `getSuggestedQuestions` |
| POST | `/explanations/{id}/chat` | `createChatSession` (201) |
| POST | `/chat/{session_id}/messages` | `askChatQuestion` (202) |
| GET | `/chat/{session_id}/messages` | `listChatMessages` |
