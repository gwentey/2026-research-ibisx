"""Application Celery unique (ADR-004) — même image Docker que l'API.

4 files : training (concurrence faible), xai, llm, maintenance.
Le worker importe les mêmes modules que l'API : zéro duplication de logique (P3).
"""

from celery import Celery

from ibis.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "ibis",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "ibis.workers.tasks.smoke",
        "ibis.workers.tasks.guide",
        "ibis.workers.tasks.train",
        "ibis.workers.tasks.maintenance",
        "ibis.workers.tasks.explain",
        "ibis.workers.tasks.kaggle",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=10,
    result_expires=24 * 3600,
    task_default_queue="maintenance",
    task_routes={
        "ibis.workers.tasks.smoke.*": {"queue": "maintenance"},
        "ibis.workers.tasks.guide.*": {"queue": "llm"},
        "ibis.workers.tasks.train.*": {"queue": "training"},
        "ibis.workers.tasks.maintenance.*": {"queue": "maintenance"},
        "ibis.workers.tasks.explain.generate_explanation": {"queue": "xai"},
        "ibis.workers.tasks.explain.answer_chat_question": {"queue": "llm"},
        # Import Kaggle : réseau + pandas, mais jamais d'entraînement — file maintenance,
        # pour ne pas occuper la file `training` bridée à 1 en production.
        "ibis.workers.tasks.kaggle.*": {"queue": "maintenance"},
    },
    beat_schedule={
        # Détection de worker perdu : running sans battement > 10 min → WORKER_LOST
        "purge-stale-running": {
            "task": "ibis.workers.tasks.maintenance.purge_stale_running",
            "schedule": 300.0,
        },
        # Sessions de chat inactives depuis 24 h → désactivées (CDC §9.6)
        "purge-expired-chat-sessions": {
            "task": "ibis.workers.tasks.maintenance.purge_expired_chats",
            "schedule": 3600.0,
        },
    },
    # Hors du bind mount du code (dev) — fichier d'état interne de beat
    beat_schedule_filename="/tmp/celerybeat-schedule",
)
