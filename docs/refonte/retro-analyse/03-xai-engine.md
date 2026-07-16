# Rétro-ingénierie — xai-engine-service (IBIS-X)

## Vue d'ensemble
Service FastAPI + Celery d'explicabilité (XAI). Consomme modèles/datasets de ml-pipeline-service, calcule SHAP/LIME, génère visualisations matplotlib, produit explication textuelle via LLM (OpenRouter/OpenAI gpt-5-mini), chat conversationnel sur les résultats. Port 8083. Worker Celery queues xai_queue/llm_queue.

**Deux chemins d'exécution parallèles** :
1. Chemin « classique » (Celery, calcul réel SHAP/LIME) — generate_explanation_task.
2. Chemin « pré-calculé » (synchrone DANS l'endpoint POST, aucun calcul XAI) — réutilise feature_importances_ natives (Gini) du modèle calculées par ml-pipeline. C'est le chemin NOMINAL actuel.

## 1. Méthodes XAI
- **SHAP 0.43.0** : TreeExplainer forcé pour modèles arbres (RF/DT) ; fallback DirectImportanceExplainer (feature_importances_ tilées, étiqueté honnêtement method='feature_importance') ; KernelExplainer pour non-arbres (background shap.sample min(100), random_state=42).
  - Multi-classe local : contributions de la classe prédite. Multi-classe global : moyenne |SHAP| toutes classes (mean_abs). shap_max_display_features=20.
- **LIME 0.2.0.1** : LimeTabularExplainer, categorical par dtype, discretize_continuous=True, random_state=42, num_features=10, num_samples config 1000 (jamais passé !). Global LIME = agrégation de 50 explications locales, moyenne |poids|.
- **choose_best_explainer** : préférence utilisateur sinon heuristique binaire : modèle arbre → SHAP, sinon → LIME. C'est le SEUL système de recommandation.
- **Feature importance native** (Gini, top 20) servie sous method_used='feature_importance' (pas un vrai calcul XAI).
- PAS de PDP, ICE, permutation importance, counterfactuals, anchors.

## 2. KPI / métriques XAI — quasi inexistantes
- processing_time_seconds (temps de calcul). Chemin pré-calculé : forcé 0.1s.
- Score fidélité locale LIME (R² du modèle linéaire local) remonté clé 'score' mais NON stocké/exposé.
- shap_metadata = {random_state, multiclass_policy, sample_size} (traçabilité).
- feature_importance : SHAP global = mean(|SHAP|) ; LIME global = mean(|poids|) ; native = Gini normalisée somme≈1.
- Métriques d'USAGE endpoint /metrics/user : total/completed/failed requests, average_processing_time, success_rate, most_used_method (="shap" EN DUR).
- PAS de fidélité formelle, stabilité, complexité, robustesse, sparsité.
- Métriques ML remontées pour prompts LLM : accuracy, f1_macro, precision_macro, recall_macro, confusion_matrix, overall_score=accuracy*100 ; régression : r2, mae, mse, rmse, overall_score=r2*100.

## 3. Visualisations
matplotlib 3.8.2 + seaborn 0.13.0, PNG base64 → MinIO (bucket ibis-x-xai-artifacts).
1. Bar chart horizontal importance globale (top 15, palette viridis novice / coolwarm autres, annotations si novice, DPI 150).
2. « Waterfall » local simplifié = barh top 10 |SHAP|, rouge négatif / vert positif, annotations valeur SHAP + valeur d'instance. Pas un vrai shap.waterfall_plot.
3. LIME : bar chart horizontal des poids.
⚠️ Dans le flux nominal (pré-calculé), visualizations={} : les graphes sont délégués à ml-pipeline. has_visualizations=False en dur au listing. Endpoint artifacts/download SUPPRIMÉ alors que table + URLs subsistent.

## 4. Endpoints (préfixe /explanations, auth header X-User-ID injecté par gateway)
1. POST /explanations/ — ExplanationRequestCreate → request_id (si ml_context.feature_importance présent : traitement SYNCHRONE inline complet, sinon Celery xai_queue)
2. GET /explanations/{request_id} — statut+progress
3. GET /explanations/{request_id}/results — résultats (shap_values | feature_importance | lime_explanation + text_explanation)
4. GET /explanations/ — liste (skip/limit/status)
5. POST /explanations/{request_id}/chat — créer session chat (language, max_questions 1-10)
6. POST /explanations/chat/{session_id}/ask — question (≤500 chars) → task_id async
7. GET /explanations/chat/tasks/{task_id} — polling statut tâche chat
8. GET /explanations/chat/{session_id}/messages — historique
9. GET /explanations/metrics/user — métriques usage
10-12. /health, /, /info
⚠️ router inclus 2 fois (routes dupliquées /explanations/explanations/...).

## 5. Modèle de données (PostgreSQL, UUID PK, JSONB)
- **explanation_requests** : user_id, experiment_id, dataset_id ; explanation_type (global/local/feature_importance), method_requested, method_used, audience_level (novice/intermediate/expert), language (fr/en) ; instance_data JSONB, instance_index (jamais utilisé serveur) ; user_preferences JSONB (contient ml_context + profil) ; status (pending/running/completed/failed), progress 0-100, task_id, error_message ; résultats : shap_values JSONB, lime_explanation JSONB, visualizations JSONB, text_explanation Text ; model_algorithm, processing_time_seconds, timestamps.
- **chat_sessions** : FK explanation_request_id, language, max_questions (5), questions_count, is_active, status, last_activity.
- **chat_messages** : FK session, message_type (user_question/ai_response/system), content, message_order, tokens_used, response_time_seconds (=0.0 en dur), model_used, context_data.
- **explanation_artifacts** : artifact_type, file_name, file_path, size, mime, is_primary, display_order (plus exposée).

## 6. Async
Celery 5.3.4 + Redis 5.0.1, app "ibis_x_cluster" (partagée avec ML Pipeline). time_limit 30min/soft 25min, prefetch 1, max_tasks_per_child 100, retries 3. Progression par paliers en base : 10→25→30→40→50→70→85→100. Polling front (pas de WS/SSE).
Tâches : generate_explanation_task ; process_chat_question ; cleanup_expired_sessions (24h) ; generate_explanation_metrics (VIDE/TODO).
⚠️ generate_explanation_with_precalculated_shap : tâche orpheline jamais dispatchée (le chemin pré-calculé s'exécute en synchrone dans le handler HTTP, bloque le POST le temps de l'appel LLM).

## 7. Global vs local
- Global : échantillon min(100) SHAP / min(50) LIME. max_explanation_instances=100.
- Local : instance_data fournie par le front uniquement ; pas de sélection serveur d'instance représentative.
- Exclusion colonnes cibles/IDs avant explication ; ne garde que colonnes numériques prédictives.

## 8. Recommandation/comparaison XAI
- Recommandation = heuristique binaire arbre/non-arbre + préférence utilisateur. Rien basé sur taille données, dimensionnalité, temps estimé.
- Comparaison entre méthodes : INEXISTANTE (pas de SHAP+LIME parallèle, pas d'accord inter-méthodes).

## 9. Dépendances & communication
- shap 0.43.0, lime 0.2.0.1, scikit-learn 1.3.2, pandas 2.1.4, numpy 1.26.2, matplotlib 3.8.2, seaborn 0.13.0, joblib 1.3.2, pyarrow 14.0.1 ; fastapi 0.104.1, pydantic 2.5.0 ; sqlalchemy 2.0.23, asyncpg, alembic ; celery 5.3.4, redis 5.0.1 ; openai 1.51.2, tiktoken ; minio 7.2.0, azure-storage-blob.
- LLM : OpenRouter par défaut (fallback OpenAI), modèle gpt-5-mini, temperature 0 pour reproductibilité, prompts par niveau (débutant/intermédiaire/expert) et langue (fr/en) avec longueurs minimales imposées (180/280/320 mots), fallback statique honnête.
- Chat : max 5 questions, timeout session 24h, max_tokens_per_question 200, historique 10 messages.
- Comm ml-pipeline : (1) HTTP GET /experiments/{id}/results + download .joblib MinIO ; (2) HTTP service-selection GET /datasets/{id} + download parquet ; (3) ⚠️ SQL DIRECT sur table experiments d'un autre service (anti-pattern) ; (4) client HTTP dédié ml_pipeline_client.py = code mort.
- Auth : header X-User-ID (401 sinon). Profil utilisateur pris depuis user_preferences.user_profile envoyé par le front.
- Limites : max_concurrent_explanations=5, explanation_timeout=30min, max_dataset_size_mb=500.

## 10. Dettes clés pour refonte
- Méthodes XAI limitées (SHAP+LIME) ; aucune métrique de qualité XAI ; deux chemins parallèles + code mort massif ; visualisations désactivées flux nominal ; couplage BDD inter-services ; incohérences URLs ; router dupliqué ; prompts LLM sur-contraints (risque hallucination chiffres) ; pas de comparaison de méthodes.
