# ADR-006 — Bibliothèques IA : ML, XAI et LLM

- **Statut** : accepté (2026-07-16)
- **Source** : [docs/refonte/02-ARCHITECTURE.md](../refonte/02-ARCHITECTURE.md) §9

## Décision

**Pile data-science épinglée** : pandas ≥ 2.2 + pyarrow, numpy 1.26.x (< 2 tant que shap/lime non validés), scikit-learn ≥ 1.5, scipy ≥ 1.13, joblib, **shap ≥ 0.46** (TreeExplainer par défaut sur les arbres, KernelExplainer en repli), **lime 0.2.0.1**.

- **Registre d'algorithmes** : chaque algo = wrapper (`fit/predict/predict_proba/importances/tree_structure`) + schéma d'hyperparamètres (source du formulaire dynamique ET de la validation). Ajout d'un algo = 1 fichier + 1 entrée — [NE PAS REPRODUIRE] T8 (recommandations hors catalogue).
- **Reproductibilité (P4)** : `random_state=42` partout (split, modèle, `shap.sample`, LIME, aperçus) ; seeds et politiques enregistrés dans les métadonnées ; test e2e « double run → diff nulle ».
- **KPI XAI calculés** (complétude SHAP, stabilité Spearman seeds 42–46, fidélité LIME, accord inter-méthodes, parcimonie) : fonctions pures testées dans `modules/xai/quality.py`.
- **LLM : OpenRouter EXCLUSIVEMENT** — un seul client (`modules/llm`), une seule clé `OPENROUTER_API_KEY`, modèle piloté par `LLM_MODEL` (défaut `openai/gpt-5-mini`). Température 0 pour les explications. Anti-hallucination : prompt = uniquement les vraies valeurs + post-validation des nombres cités.
- **Fallback déterministe** pour chaque usage LLM, marqué `is_fallback: true` (P2) : la plateforme est 100 % fonctionnelle sans clé.

## Conséquences

- [NE PAS REPRODUIRE] les 3 services LLM divergents et le faux « SHAP » (Gini relabellisé) de la v1.
- Changer de modèle/fournisseur amont = changer une variable d'env, zéro code.
