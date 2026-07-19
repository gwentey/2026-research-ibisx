# RETRO-api-xai-01 — Niveau d'audience capturé immuablement par explication

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documenté (rétro)   |
| Date       | 2026-07-19          |
| Source     | Rétro-ingénierie    |
| Features   | api/xai             |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DATA-MODEL |
| Q1 — Coût de revert > 1j ? | OUI — `audience_level` est une colonne VARCHAR(20) sur la table `explanations` (migration nécessaire), utilisée dans les prompts LLM (`xai_text.py`), dans le fallback `blocks.py` (`_fallback_intro`), et dans le worker (`answer_chat_question` qui lit `explanation.audience_level`). Modifier la granularité ou la sémantique nécessite : migration DB, mise à jour de toutes les branches de prompt, mise à jour du fallback, test de non-régression. > 1 journée. |
| Q2 — Non-déductible du code ? | OUI — Deux règles ne sont pas lisibles dans les configs : (a) l'override `audience` de la requête est éphémère — il ne modifie jamais `user.xai_audience` (commentaire `[décision D1]` dans `service.py` ligne 63) ; (b) `audience_level` est capturé à la création de l'explication et ne change plus ensuite (immutabilité post-création). Ces deux invariants sont des choix d'architecture, pas des configurations. |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — Impacte : `api/auth` (`XaiAudience` enum défini dans `auth/models.py`, champ `xai_audience` sur `User`) ; `api/xai` (`audience_level` sur `Explanation`, logique d'override dans `service.py`) ; `api/llm` (`AUDIENCE_SPECS` et `AUDIENCE_CHAT_TONE` dans `xai_text.py` qui pilotent la profondeur et le ton LLM) ; `web/xai` (le frontend passe `audience` dans les requêtes et affiche différemment selon le niveau). |
| Q4 — Casse un invariant si ignoré ? | OUI — Un développeur qui ignorerait cet invariant pourrait : (a) persister l'override éphémère dans `user.xai_audience`, modifiant silencieusement le profil permanent de l'utilisateur — corruption de préférence ; (b) passer `"intermediate"` en dur dans le worker au lieu de lire `explanation.audience_level`, produisant des explications au mauvais niveau pour tout utilisateur novice ou expert ; (c) modifier `audience_level` après création de l'explication, rendant le texte généré incohérent avec les métadonnées stockées. |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

IBIS-X cible trois profils d'audience (`novice / intermediate / expert`) qui influencent la profondeur et le ton des explications XAI (cf. CDC §5.1 et §5.2 référencés dans le code). Le profil est stocké sur le compte utilisateur (`user.xai_audience`) et peut être surchargé de façon éphémère à la demande (bouton « Voir en tant que »).

Pour qu'une explication reste cohérente après coup (le texte LLM, le fallback, et les métadonnées doivent parler au même niveau), le niveau effectif au moment de la création est capturé immuablement sur l'entité `Explanation`. Cela permet de retrouver le niveau original même si l'utilisateur change son profil ultérieurement.

## Décision identifiée

1. L'enum `XaiAudience` (`novice / intermediate / expert`) est défini dans `ibis/modules/auth/models.py` et porté par `User.xai_audience`.
2. À la création d'une `Explanation`, le niveau effectif est résolu selon : `(audience or user.xai_audience).value` et stocké dans `Explanation.audience_level` (VARCHAR, immuable post-création).
3. Le paramètre `audience` de `POST /experiments/{id}/explanations` est éphémère : il influence `audience_level` de l'explication créée, mais ne modifie jamais `user.xai_audience`.
4. Le worker `generate_explanation` et `answer_chat_question` lisent `explanation.audience_level` pour adapter le texte LLM (profondeur en mots, ton, vocabulaire) via `AUDIENCE_SPECS` / `AUDIENCE_CHAT_TONE` dans `xai_text.py`.
5. Le fallback déterministe (`fallback_document` dans `blocks.py`) prend également `audience` en paramètre pour adapter l'intro même sans LLM.

## Conséquences observées

### Positives
- La cohérence texte / métadonnées est garantie : une explication novice reste novice dans ses métadonnées et dans son texte, même si l'utilisateur change de profil plus tard.
- L'override éphémère ne corrompt pas les préférences persistées.
- Le fallback déterministe bénéficie aussi de l'adaptation de niveau.

### Négatives / Dette
- L'enum `XaiAudience` est défini dans le module `auth`, pas dans `xai`. Un développeur cherchant la définition du niveau cherchera d'abord dans `xai/` et ne le trouvera pas.
- Ajouter un 4e niveau (ex. `researcher`) nécessite une migration de la colonne `audience_level` (VARCHAR) ET une mise à jour de l'enum `auth/models.py` — deux modules à synchroniser.

## Recommandation

Garder. L'immutabilité post-création est un invariant sain. Envisager à terme de déplacer `XaiAudience` dans un module `core` ou `xai` pour améliorer la cohésion.
