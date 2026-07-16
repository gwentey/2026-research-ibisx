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
    },
    beat_schedule={},  # tâches périodiques ajoutées en J5/J6 (purges, expirations)
    # Hors du bind mount du code (dev) — fichier d'état interne de beat
    beat_schedule_filename="/tmp/celerybeat-schedule",
)
