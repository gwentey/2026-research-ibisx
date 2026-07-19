# VERSIONNING — api/xai

| Version | Date | Artefact/Composant | Changement | Auteur |
|---------|------|--------------------|------------|--------|
| 0.2.0 | 2026-07-19 | `models.py`, `blocks.py`, `routes.py`, `service.py`, `explain.py` | Évolutions XAI §2/§3/§4 : nouvelle colonne explanations.text_blocks (JSONB nullable, migration 0009) ; fallback_document humanisé (humanize_feature/format_share, Poids %) ; ExplanationResults expose text_blocks ; latest_completed_explanation dans service ; getSuggestedQuestions enrichi (top feature + métrique) ; explain.py factorisé (_blocks_completion, _fallback_payload, _generate_explanation_blocks) | Anthony |
| 0.1.0 | 2026-07-19 | Tous les fichiers | Version initiale — rétro-ingénierie complète du module | Anthony |
