# RETRO-002 — Niveau d'audience XAI : dérivation, priorité au choix explicite, et capture immuable

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documenté (rétro)   |
| Date       | 2026-07-19          |
| Source     | Rétro-ingénierie    |
| Features   | api/auth, api/users, api/xai, api/llm, web/onboarding, web/experiments |

> **ADR consolidé** : regroupe quatre décisions rétro portant sur le même invariant transverse
> (le niveau d'audience XAI). Remplace les fiches par-feature initiales (dérivation à
> l'onboarding, priorité au choix explicite, duplication front/back de la règle, capture
> immuable par explication).

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DATA-MODEL |
| Q1 — Coût de revert > 1j ? | OUI — changer le nombre de niveaux ou la sémantique de l'audience touche : la colonne `users.xai_audience` et `Explanation.audience_level` (migrations Alembic), `derive_xai_audience()` (auth) + `audienceFor()` (web/onboarding), les politiques `BLOCK_MIN_AUDIENCE` (api/xai), les cibles de profondeur `AUDIENCE_SPECS`/`AUDIENCE_CHAT_TONE` (api/llm), et la visibilité adaptative de web/experiments. Refactoring cross-layer > 1 journée. |
| Q2 — Non-déductible du code ? | OUI — les seuils (≤ 2 → novice, = 3 → intermediate, ≥ 4 → expert), la règle « re-dériver sauf si `xai_audience` explicite dans le PATCH », le caractère **éphémère** de l'override « Voir en tant que » et l'**immutabilité post-création** de `audience_level` ne figurent dans aucune config — uniquement dans le corps des fonctions et des commentaires `[décision D1]` / « CDC §4.1 ». |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — api/auth, api/users, api/xai, api/llm, web/onboarding, web/experiments (et web/xai). |
| Q4 — Casse un invariant si ignoré ? | OUI — un override éphémère persisté écraserait la préférence permanente ; un seuil modifié d'un seul côté (front OU back) désynchroniserait l'aperçu et la valeur stockée ; une `audience_level` mutée après coup rendrait le texte incohérent avec ses métadonnées. |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

Le niveau d'audience (`novice / intermediate / expert`) pilote toute l'adaptation XAI : profondeur des textes LLM (~180/250/320 mots), ton du copilote, visibilité des blocs de résultats. Il est capturé à l'onboarding depuis une familiarité IA (échelle 1–5, « CDC §4.1 »), surchargeable, et doit rester cohérent de bout en bout — du profil jusqu'à chaque explication générée.

## Décision identifiée

1. **Enum & stockage.** `XaiAudience (novice/intermediate/expert)` est défini dans `apps/api/ibis/modules/auth/models.py` et porté par `User.xai_audience` (défaut `novice`).
2. **Dérivation à l'écriture.** `derive_xai_audience(ai_familiarity)` applique `≤ 2 → novice`, `= 3 → intermediate`, `≥ 4 → expert`, à la complétion de l'onboarding et lors d'un `PATCH /users/me` **qui fournit `ai_familiarity` sans `xai_audience`**. Jamais recalculée on-read.
3. **Priorité au choix explicite.** Un `xai_audience` explicitement fourni dans le PATCH prend la priorité et bloque la redérivation — l'utilisateur avancé peut se déclarer « novice » temporairement sans qu'un changement de familiarité l'annule.
4. **Duplication front/back assumée.** La même règle est répliquée côté web dans `audienceFor()` (`app/onboarding/page.tsx`) pour un aperçu instantané sans aller-retour réseau. Duplication intentionnelle (6 lignes), sans test de parité automatique.
5. **Capture immuable par explication.** À la création d'une `Explanation`, le niveau effectif `(audience or user.xai_audience)` est figé dans `Explanation.audience_level` (VARCHAR, immuable). L'override `audience` de `POST /experiments/{id}/explanations` (bouton « Voir en tant que ») est **éphémère** : il n'écrit jamais `user.xai_audience`. Le worker et le fallback lisent `audience_level`, garantissant que texte et métadonnées parlent au même niveau même si le profil change ensuite.

## Conséquences observées

### Positives
- Lecture d'audience sans recalcul (performance constante) ; aperçu onboarding instantané.
- L'override éphémère ne corrompt jamais la préférence persistée.
- Cohérence texte ↔ métadonnées garantie par l'immutabilité de `audience_level`.

### Négatives / Dette
- **Divergence silencieuse** possible entre `ai_familiarity` et `xai_audience` si l'un change sans l'autre.
- **Duplication front/back** des seuils sans garde-fou : un seul côté modifié → aperçu ≠ valeur livrée. Un test de parité Vitest/pytest sur les 5 entrées manque.
- `XaiAudience` vit dans `auth/`, pas `xai/` — cohésion perfectible (candidat à un module `core`).
- La priorité « override explicite » n'est pas exposée côté client (pas de `xai_audience_source`).

## Recommandation

Garder. La dérivation à l'écriture + capture immuable est le bon modèle pour une métadonnée consommée à haute fréquence. Améliorations à terme : test de parité front/back sur les seuils ; champ `xai_audience_source: derived|explicit` exposé à l'API ; déplacement de l'enum vers `core`/`xai`.
