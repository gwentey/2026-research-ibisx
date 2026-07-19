# RETRO-api-users-01 — Dérivation de xai_audience à l'écriture avec priorité au choix explicite

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documenté (rétro)   |
| Date       | 2026-07-19          |
| Source     | Rétro-ingénierie    |
| Features   | api/users           |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DATA-MODEL |
| Q1 — Coût de revert > 1j ? | OUI — supprimer la règle d'override explicit ou passer à un calcul on-read toucherait le service users, l'engine XAI (`BLOCK_MIN_AUDIENCE`), le générateur LLM (`xai_text.py`, longueurs cibles 180/250/320 mots), et la visibilité des blocs côté web/experiments : refactoring transverse > 1 journée |
| Q2 — Non-déductible du code ? | OUI — la règle "si `xai_audience` est absent du payload PATCH, redériver depuis `ai_familiarity` ; si présent, ne pas écraser" n'apparaît dans aucun fichier de config (`package.json`, `pyproject.toml`, `.env.*`) ; elle requiert la lecture conjointe de `derive_xai_audience` (models.py) et de la condition `explicit_audience` (service.py l.39-44) |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — api/users (écriture de la valeur), api/xai (politique `BLOCK_MIN_AUDIENCE` consomme l'audience), api/llm (profondeur des textes 180/250/320 mots), web/experiments (visibilité des blocs de résultats) — au moins 4 specs concernées |
| Q4 — Casse un invariant si ignoré ? | OUI — un dev qui modifie `update_profile` sans connaître la condition `explicit_audience` pourrait écraser silencieusement la préférence XAI explicitement choisie par l'utilisateur, forçant un niveau inadapté (ex. : expert → novice si `ai_familiarity` est mis à 2 sans intention de changer l'audience) |

> ✅ Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

Le niveau d'audience XAI (`xai_audience : novice | intermediate | expert`) pilote trois comportements transverses : la longueur des textes générés par le LLM (~180/250/320 mots), la politique de visibilité des blocs de résultats (`BLOCK_MIN_AUDIENCE`), et le ton du copilote d'explication. Ce niveau doit rester cohérent avec la familiarité IA déclarée par l'utilisateur, mais l'application doit aussi respecter un choix explicite de l'utilisateur qui souhaite outrepasser la valeur calculée.

## Décision identifiée

La valeur `xai_audience` est dérivée **à l'écriture** depuis `ai_familiarity` via `derive_xai_audience` (familiarité 1–2 → novice, 3 → intermediate, 4–5 → expert, CDC §4.1), à deux moments :

1. **Onboarding** (`complete_onboarding`) : dérivation systématique et sans exception.
2. **Mise à jour du profil** (`update_profile`) : redérivation **seulement si** `ai_familiarity` est présent dans le payload **ET** que `xai_audience` est absent — un `xai_audience` explicitement fourni dans le même PATCH prend la priorité et bloque la redérivation.

La valeur calculée est persistée en base (colonne `users.xai_audience`), jamais calculée on-read.

## Conséquences observées

### Positives
- Lecture de l'audience depuis la BDD sans recalcul à chaque requête : performance constante.
- Possibilité pour un utilisateur avancé de se déclarer « novice » temporairement (pédagogie, démo) sans que la mise à jour de sa familiarité annule ce choix.
- Cohérence garantie entre l'audience et la familiarité dans le cas nominal (onboarding + pas d'override).

### Négatives / Dette
- Divergence silencieuse possible : si `ai_familiarity` change sans que `xai_audience` soit recalculé (pas de mise à jour explicite), les deux champs peuvent être incohérents en base sans que l'application le signale.
- La règle de priorité (override explicite) n'est pas documentée côté client (`ProfileUpdateRequest`) : un intégrateur pourrait ignorer le comportement.

## Recommandation

Garder. La dérivation à l'écriture est le bon modèle pour un champ consommé à haute fréquence (chaque requête XAI). Envisager d'ajouter un champ `xai_audience_source: "derived" | "explicit"` pour exposer l'état à l'API et permettre une cohérence-check côté client.
