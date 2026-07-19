# RETRO-api-auth-02 — XaiAudience 3 niveaux dérivée à l'onboarding depuis ai_familiarity

| Champ      | Valeur                |
|------------|-----------------------|
| Statut     | Documenté (rétro)     |
| Date       | 2026-07-19            |
| Source     | Rétro-ingénierie      |
| Features   | api/auth, api/xai, api/llm, web/experiments |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DATA-MODEL |
| Q1 — Coût de revert > 1j ? | OUI — Changer le nombre de niveaux (ex : 4 niveaux) nécessiterait une migration Alembic de la colonne `xai_audience`, la mise à jour de `derive_xai_audience()`, la révision de toutes les politiques `BLOCK_MIN_AUDIENCE` dans `api/xai`, des cibles de profondeur texte dans `api/llm` (~180/250/320 mots), et de la logique de visibilité adaptative dans `web/experiments`. |
| Q2 — Non-déductible du code ? | OUI — Le mapping spécifique 1-2 → novice / 3 → intermediate / 4-5 → expert n'est pas visible dans package.json ni dans les configs. La règle est encodée dans la fonction `derive_xai_audience()` de `models.py` avec uniquement un commentaire de référence au CDC §4.1. |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — api/auth (définition de `XaiAudience` et `derive_xai_audience()`, stockage dans `users.xai_audience`), api/xai (politiques de visibilité des blocs XAI par audience), api/llm (profondeur des explications textuelles par audience), web/experiments (visibilité adaptative des sections de résultats). |
| Q4 — Casse un invariant si ignoré ? | OUI — Un dev qui ajoute un 4e niveau d'audience ou modifie la dérivation sans mettre à jour les politiques de visibilité XAI crée une incohérence silencieuse : les anciens utilisateurs restent bloqués sur `novice` (valeur par défaut), les textes LLM et les blocs XAI ne couvrent pas le nouveau niveau, sans aucune erreur visible. |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

La plateforme IBIS-X adapte la profondeur des explications XAI au niveau de familiarité de l'utilisateur avec l'IA. Ce niveau est capturé lors de l'onboarding (question `ai_familiarity` sur une échelle 1-5) et converti en une des trois valeurs d'audience. Cette valeur pilote ensuite de nombreux comportements en aval : profondeur des textes LLM, visibilité de certains blocs de résultats, ton du copilote de chat XAI.

## Décision identifiée

La classification est réalisée **une seule fois, lors de la complétion de l'onboarding**, et stockée comme attribut du compte utilisateur (`users.xai_audience`). La règle de dérivation est :

```
ai_familiarity 1 ou 2  → XaiAudience.novice
ai_familiarity 3       → XaiAudience.intermediate
ai_familiarity 4 ou 5  → XaiAudience.expert
```

La valeur par défaut du compte à la création est `novice`. Elle peut être mise à jour manuellement par l'utilisateur via son profil (champ `xai_audience` dans `ProfileUpdateRequest`), indépendamment de `ai_familiarity`.

## Conséquences observées

### Positives
- La classification est effectuée au write (onboarding), non recalculée à chaque lecture — cohérente avec le principe de reproductibilité, et sans surcoût à la lecture.
- L'utilisateur peut outrepasser la valeur calculée en la modifiant manuellement dans son profil.
- Les modules consommateurs (xai, llm, web) n'ont pas à re-dériver le niveau — ils lisent directement `user.xai_audience`.

### Négatives / Dette
- Si la règle de mapping change (ex. : passage à 4 niveaux), les comptes existants ne sont pas reclassés automatiquement — une migration de données est nécessaire.
- La dérivation se fait côté module users (`OnboardingRequest` → endpoint dans api/users), mais l'enum et la fonction `derive_xai_audience()` sont définis dans `api/auth`. Cette dépendance croisée est cohérente mais doit être maintenue.

## Recommandation

Garder. La classification au write est la bonne approche pour ce type de métadonnée de personnalisation. Si les niveaux doivent évoluer, prévoir une migration Alembic + un script de reclassification pour les comptes existants.
