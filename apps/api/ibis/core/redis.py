"""Clients Redis partagés — sync (worker, health) et async (SSE)."""

from functools import lru_cache

import redis
import redis.asyncio as aioredis

from ibis.core.config import get_settings


@lru_cache
def get_sync_redis() -> redis.Redis:
    return redis.Redis.from_url(get_settings().redis_url, decode_responses=True)


@lru_cache
def get_async_redis() -> aioredis.Redis:
    return aioredis.Redis.from_url(get_settings().redis_url, decode_responses=True)


def job_channel(job_id: str) -> str:
    """Canal pub/sub d'un job (le worker publie, l'endpoint SSE consomme)."""
    return f"ibis:jobs:{job_id}"
