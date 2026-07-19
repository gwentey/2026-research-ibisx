# RETRO-web-onboarding-01 — Règle de dérivation familiarity → xai\_audience dupliquée frontend + backend

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documenté (rétro)   |
| Date       | 2026-07-19          |
| Source     | Rétro-ingénierie    |
| Features   | web/onboarding, api/users, api/auth |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DATA-MODEL |
| Q1 — Coût de revert > 1j ? | OUI — modifier les seuils (ex. ajouter un 4e niveau ou décaler le seuil intermédiaire) nécessite : (1) migration de données pour re-dériver `xai_audience` de tous les utilisateurs existants depuis leur `ai_familiarity` stocké ; (2) mise à jour synchronisée de `derive_xai_audience()` dans `apps/api/ibis/modules/auth/models.py` ET de `audienceFor()` dans `apps/web/app/onboarding/page.tsx` ; (3) mise à jour des tests d'intégration (`test_users_me.py`) et des commentaires de code ; (4) vérification que `AUDIENCE_SPECS` / `AUDIENCE_CHAT_TONE` dans `api/llm` restent cohérents. Coordination multi-fichiers cross-layer > 1 journée. |
| Q2 — Non-déductible du code ? | OUI — les seuils spécifiques (≤ 2 → novice, = 3 → intermediate, ≥ 4 → expert) sont uniquement dans le corps de `derive_xai_audience()` et `audienceFor()`. Aucun fichier `package.json`, `tsconfig.json` ou configuration d'outil ne révèle ces valeurs. La règle « re-dériver automatiquement sauf si `xai_audience` est fourni explicitement dans PATCH » (branche conditionnelle dans `update_user()`) n'est visible que dans le code service. |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — `web/onboarding` (aperçu en temps réel via `audienceFor()`) ; `api/auth` (`XaiAudience` enum et `User.xai_audience`, `derive_xai_audience()`) ; `api/users` (re-dérivation sur `PATCH /users/me`) ; et par extension `api/xai` + `api/llm` + `web/experiments` + `web/xai` qui consomment `xai_audience` pour adapter la profondeur et le ton des explications. |
| Q4 — Casse un invariant si ignoré ? | OUI — deux risques directs : (a) un dev mettant à jour `derive_xai_audience()` sans toucher `audienceFor()` produit un écart entre l'aperçu affiché à l'étape 3 et le niveau réellement stocké — l'utilisateur voit un style d'explication promis qui ne correspond pas à ce qui est livré ; (b) un dev ignorant la re-dérivation automatique dans `update_user()` pourrait croire que modifier `ai_familiarity` via PATCH ne change rien à `xai_audience`, laissant les deux champs incohérents silencieusement. |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

IBIS-X adapte la profondeur et le ton de toutes ses explications XAI en fonction du niveau d'audience de l'utilisateur (`novice / intermediate / expert`). Ce niveau est stocké dans `User.xai_audience` et dérivé à partir de la question de familiarité IA collectée lors de l'onboarding (échelle de Likert 1–5, commentée « CDC §4.1 » dans le code).

Pour que l'utilisateur puisse voir un aperçu en temps réel du style d'explication qui l'attend (encadré « Aperçu de vos explications » à l'étape 3), la règle de dérivation est dupliquée côté frontend dans la fonction `audienceFor()`. Cette duplication est intentionnelle et documentée par un commentaire dans le code source — elle élimine un aller-retour réseau à chaque changement de sélection.

Le même calcul côté backend (`derive_xai_audience()`) est appelé :
- à la complétion de l'onboarding (`POST /users/me/onboarding`)
- lors d'une mise à jour de profil qui inclut `ai_familiarity` sans `xai_audience` explicite (`PATCH /users/me`)

## Décision identifiée

1. La règle de dérivation est `familiarity ≤ 2 → novice`, `familiarity == 3 → intermediate`, `familiarity ≥ 4 → expert`.
2. Cette règle est implémentée en deux endroits :
   - **Backend** : `derive_xai_audience(ai_familiarity: int) -> XaiAudience` dans `apps/api/ibis/modules/auth/models.py` (commentaire : « CDC §4.1 »).
   - **Frontend** : `audienceFor(familiarity: number)` dans `apps/web/app/onboarding/page.tsx` — identique, locale à la page.
3. Lors d'un `PATCH /users/me`, si `ai_familiarity` est fourni sans `xai_audience` explicite, le backend re-dérive automatiquement `xai_audience`. Si `xai_audience` est fourni explicitement, la valeur est acceptée telle quelle sans re-dérivation.
4. `User.xai_audience` est initialisé à `novice` par défaut (avant onboarding) dans la définition du modèle SQLAlchemy.

## Conséquences observées

### Positives
- L'aperçu est instantané côté client sans latence réseau.
- La règle est simple et testée (test d'intégration `test_onboarding_flow` vérifie explicitement `xai_audience == "novice"` pour `ai_familiarity = 2`).
- Le re-dérivation automatique sur PATCH évite les incohérences entre `ai_familiarity` et `xai_audience` dans le cas courant.

### Negatives / Dette
- **Duplication à maintenir** : toute modification des seuils requiert une mise à jour synchronisée dans deux fichiers distincts (une frontend, une backend) sans mécanisme de vérification automatique.
- Aucun test n'assure la correspondance exacte entre `audienceFor()` et `derive_xai_audience()` — un test unitaire comparant les deux sorties sur les 5 valeurs serait une garde-fou utile.

## Recommandation

Garder. La duplication est minimale (6 lignes de logique) et le bénéfice UX (aperçu instantané) est réel. Ajouter un commentaire dans `audienceFor()` renvoyant explicitement vers `derive_xai_audience()` et, à terme, un test de parité Vitest/pytest sur les 5 entrées.
