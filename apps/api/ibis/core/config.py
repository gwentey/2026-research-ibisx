"""Configuration applicative — toutes les valeurs viennent de l'environnement (ARCH §11).

Aucune constante métier en dur ailleurs dans le code : quotas, secrets, URLs
sont définis ici et surchargés par variables d'environnement / fichier .env.
"""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: Literal["dev", "test", "production"] = "dev"
    log_level: str = "INFO"

    # --- Base de données / broker ---
    database_url: str = "postgresql+psycopg://ibis:ibis@localhost:5432/ibis"
    redis_url: str = "redis://localhost:6379/0"

    # --- Auth (ADR-003) ---
    jwt_secret: str = "dev-only-secret-change-me-0000000000000000"
    access_token_minutes: int = 30
    refresh_token_days: int = 7
    initial_admin_email: str = ""
    initial_admin_password: str = ""

    # --- Google OIDC direct (ADR-003) ---
    google_client_id: str = ""
    google_client_secret: str = ""
    oauth_redirect_url: str = "http://localhost:3000/auth/google/callback"

    # --- Stockage (ADR-005) ---
    storage_backend: Literal["local", "s3"] = "local"
    data_dir: str = "/data"

    # --- LLM via OpenRouter exclusivement (ADR-006) ---
    openrouter_api_key: str = ""
    llm_model: str = "openai/gpt-5-mini"
    llm_max_tokens: int = 2000
    llm_timeout_seconds: int = 60
    # Modèles à raisonnement (gpt-5*) : "" = désactivé (modèle classique) ;
    # "low"/"medium"/"high" = envoie l'effort de raisonnement + retire la température imposée.
    llm_reasoning_effort: str = ""

    # --- Import Kaggle ---
    # Jeton unique (nouveau format Kaggle) — prioritaire s'il est renseigné.
    kaggle_api_token: str = ""
    # Couple « legacy » (bouton « Create Legacy API Key ») — repli tant que Kaggle le propose.
    kaggle_username: str = ""
    kaggle_key: str = ""
    # Plafond d'import, en Mo, sur la taille décompressée.
    kaggle_max_dataset_mb: int = 200

    # --- SMTP (optionnel — reset de mot de passe) ---
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "IBIS-X <no-reply@ibisx.local>"

    # --- Quotas & crédits (CDC §3.3 — jamais en dur dans le code) ---
    max_concurrent_trainings: int = 3
    max_daily_trainings: int = 20
    default_credits: int = 100
    max_chat_questions: int = 5
    chat_session_timeout_hours: int = 24

    # --- Limites techniques ---
    upload_max_bytes: int = 100 * 1024 * 1024  # 100 MB (CDC §5.5)
    training_timeout_seconds: int = 2 * 60 * 60  # 2 h (CDC §8.3)
    xai_timeout_seconds: int = 30 * 60

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
