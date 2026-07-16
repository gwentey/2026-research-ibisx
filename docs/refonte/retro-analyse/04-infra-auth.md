# Rétro-ingénierie — api-gateway / common / infra (IBIS-X)

Renommage exai → ibis-x incomplet (namespace, buckets, .env.example désynchronisés). AUCUN docker-compose : tout K8s/Skaffold/Kustomize.

## 1. AUTH (api-gateway, fastapi-users)
- JWT HS256, SECRET_KEY env (défaut EN DUR dans config.py), durée 480 min = 8h, Bearer transport, claims par défaut (sub=UUID, aud, exp). PAS de claims custom (rôle relu en base à chaque requête). PAS de refresh token applicatif.
- Endpoints : POST /auth/jwt/login, /auth/jwt/logout, /auth/register (custom : auto-login + is_verified=True forcé), /auth/forgot-password + reset (email TODO non implémenté), /auth/request-verify-token + verify, OAuth Google custom (GET /auth/google/authorize, GET callback, POST exchange-token — crée user avec pseudo/picture/given_name/family_name/locale) + routeur fastapi-users get_oauth_router (associate_by_email).
- Users : GET/PATCH/DELETE /users/me, PATCH /users/me/password, PATCH /users/me/picture, POST /users/me/claim-credits, GET /admin/users, /admin/users/count, POST /admin/temporary-grant (temporaire à retirer).
- Hash : bcrypt (passlib via fastapi-users). Comptes Google : MDP aléatoire bcrypt.
- Modèle User : id UUID PK gen_random_uuid, email String(320) unique, hashed_password, is_active, is_verified, pseudo String(64) unique, picture, given_name, family_name, locale, education_level String(50) (onboarding), age SmallInt, ai_familiarity SmallInt 1-5, credits SmallInt NOT NULL déf 10, date_claim, role String(20) déf 'user' indexé.
- is_superuser SUPPRIMÉ de la DB → propriété Python (role=='admin').
- oauth_account : user_id FK, oauth_name, access_token, expires_at, refresh_token, account_id, account_email.
- Rôles : admin, contributor, user. Guards : current_active_user, current_superuser. security.py : require_role, require_admin, can_upload_datasets, filter_datasets_by_role (contributor = ses datasets + publics ; user = publics) — PAS systématiquement câblés.

## 2. Rôle api-gateway
Double : (a) auth/users, (b) reverse proxy authentifié (httpx, timeout 30s). N'envoie PAS le JWT en aval — injecte X-User-ID, X-User-Email, X-User-Role. Modèle de confiance : services jamais joignables directement.
Routage : /datasets*, /projects* → service-selection ; /api/v1/ml-pipeline/* → ml-pipeline:8082 ; /api/v1/xai/* → xai-engine. Cas spéciaux : download-model streaming, artifacts publics, debug endpoints non auth (à supprimer). CORS en dur localhost:8080, ibisx.fr. Port 8088.

## 3. common/
- storage_client.py : ABC + MinIOStorageClient + AzureBlobStorageClient, factory STORAGE_TYPE, bucket ibis-x-datasets. upload/download/delete/list.
- llm_client.py : OpenRouter défaut, repli OpenAI. LLM_MODEL déf gpt-4o-mini. Reasoning models (gpt-5, o1/o3/o4) : max_completion_tokens, pas de temperature. Headers HTTP-Referer ibisx.fr.

## 4. Stockage objet
MinIO dev / Azure Blob prod. Bucket ibis-x-datasets (+ terraform : ibis-x-models, ibis-x-reports). Chemins datasets/{dataset_uuid}/{file_uuid}.parquet, Parquet Snappy. MinIO K8s : PVC 5Gi, console 9001, API 9000.

## 5. BDD
UNE instance postgres:15 (StatefulSet, PVC 1Gi), UNE base ibis_x_db, user ibis_x_user/password EN DUR. 4 services partagent la base, isolation par tables + chaînes Alembic distinctes (alembic_version_selection etc.). Migrations via initContainers run-migrations (jobs désactivés). Gateway : asyncpg + create_all de secours.

## 6. Communication inter-services
REST direct httpx. Pas de bus. ENV : SERVICE_SELECTION_URL, ML_PIPELINE_URL, XAI_ENGINE_URL, API_GATEWAY_URL. Redis 7-alpine StatefulSet (PVC 1Gi, AOF) = broker + result backend Celery. Workers : ml-pipeline-celery-worker ×2 (ml_queue, ai_queue), xai-engine-celery-worker ×1 (xai_queue, concurrency 2). Gateway n'utilise ni Redis ni Celery.

## 7. Infra K8s (à remplacer)
11 workloads : postgresql SS, redis SS, minio, api-gateway (128Mi/100m → 256Mi/250m), service-selection (256Mi→512Mi, AUTO_INIT_DATA=true), ml-pipeline (512Mi→1Gi), ml-worker ×2 (512Mi→2Gi/1000m), xai-engine (256→512Mi), xai-worker (256Mi→1Gi), frontend nginx.
Ingress nginx + cert-manager letsencrypt (api.ibisx.fr, ibisx.fr). Pas de CronJob. Jobs migration + kaggle-import désactivés.
Secrets K8s avec VALEURS RÉELLES COMMITTÉES (Google OAuth, OpenAI/OpenRouter, JWT secret, Kaggle) — à faire tourner. .env racine avec secrets réels.
Overlays minikube / azure (ACR, STORAGE_TYPE=azure, FORCE_INIT_DATA).

## 8. Scripts
Makefile racine 42KB : make dev (install minikube complète), dev-watch, update-secrets, deploy (Skaffold), migrate, dev-data (Kaggle), port-forwards, clean/reset. scripts/development : update-local-secrets.py (injecte .env → secrets K8s), reset-placeholders, validate-kaggle-datasets, fix-portforwards. scripts/deploy-to-azure.sh (118KB). Scripts debug one-shot (heatmap, missing values, asap ethics...).

## 9. datasets/
kaggle-import/ uniquement : orchestrateur + importer_lib + kaggle_datasets_config.yaml (~32-35 datasets, majorité éducation) + enriched_metadata/ (JSON par dataset + schema.json + templates par domaine) + cache/.

## 10. ENV (.env)
JWT_SECRET_KEY, DATABASE_URL, GOOGLE_CLIENT_ID/SECRET, OAUTH_REDIRECT_URL, LOCAL_REDIRECT_URL, KAGGLE_USERNAME/KEY, OPENROUTER_API_KEY, OPENAI_API_KEY, OPENAI_MODEL (openai/gpt-5-mini), OPENAI_MAX_TOKENS (2000), OPENAI_TEMPERATURE, OPENAI_REASONING_EFFORT, MAX_CHAT_QUESTIONS (5), CHAT_SESSION_TIMEOUT_HOURS (24), MAX_TOKENS_PER_QUESTION (200).
Runtime : STORAGE_TYPE, MINIO_*, STORAGE_BUCKET, AZURE_*, CELERY_BROKER_URL, CELERY_RESULT_BACKEND, *_URL services, AUTO_INIT_DATA, FORCE_INIT_DATA, ALLOWED_ORIGINS, MAX_TRAINING_TIME, DEFAULT_TEST_SIZE.

## 11. CI/CD
1 workflow : deploy-production-v2.yml (push branche production → Azure AKS, injection secrets par sed, deploy-to-azure.sh). PAS de tests/lint/build CI.

## Refonte Docker Compose
Services : postgres, redis, minio?, api, worker, web, proxy. DNS par nom de conteneur. Migrations par entrypoint/depends_on. .env unique non versionné. Rotation des secrets exposés OBLIGATOIRE.
