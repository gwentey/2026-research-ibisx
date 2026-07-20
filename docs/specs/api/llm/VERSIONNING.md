# VERSIONNING — api/llm

| Version | Date | Artefact/Composant | Changement | Auteur |
|---------|------|--------------------|------------|--------|
| 0.3.0 | 2026-07-20 | `guides.py`, `workers/tasks/guide.py`, `tests/unit/test_guide_blocks.py` | Guide IA v2 : génération en blocs riches (même contrat BlockDocument que le copilote XAI) ; `blocks_grammar` restreinte (featureImpact exclu via `_EXCLUDED_BLOCKS`) ; `fallback_document` déterministe en blocs ; `normalize_thousands` (garde-fou séparateurs milliers) ; `numbers_are_grounded` adapté guide ; `guide_payload` gagne `blocks` ; `_generate_blocks` dans le worker (json_mode, 2 tentatives) ; 13 tests unitaires | Anthony |
| 0.2.0 | 2026-07-19 | `xai_text.py` | Évolutions XAI §1/§3/§4 : helpers humanize_feature/format_share/_round3/_importance_line ; build_context (importances %, arrondi 3 déc.) ; explanation_system_v2 + explanation_prompt_v2 (explication en blocs) ; numbers_exist_in_context tolérance ÷100 ; suggested_questions contextualisées (top_feature, metric_name) ; suppression build_prompt et fallback_text | Anthony |
| 0.1.0 | 2026-07-19 | Tous les fichiers | Version initiale — rétro-ingénierie complète du module | Anthony |
