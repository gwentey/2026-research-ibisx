"""Client LLM UNIQUE — OpenRouter exclusivement (ADR-006).

[NE PAS REPRODUIRE] les 3 services LLM divergents de la v1.
- Une seule clé (`OPENROUTER_API_KEY`), un seul chemin de code.
- Modèle piloté par `LLM_MODEL` (changer de fournisseur = changer une variable d'env).
- Température 0 par défaut (P4).
- Sans clé ou en panne : lever LLMUnavailable — l'appelant DOIT avoir un fallback
  déterministe marqué `is_fallback: true` (P2). Jamais de sortie inventée.
"""

from dataclasses import dataclass

import httpx

from ibis.core.config import get_settings
from ibis.core.logging import get_logger

logger = get_logger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class LLMUnavailable(Exception):
    """Clé absente, quota, réseau, réponse invalide — l'appelant passe en fallback."""


@dataclass(frozen=True)
class LLMResult:
    text: str
    model_used: str
    tokens_used: int
    is_fallback: bool = False


def complete(
    *,
    system: str,
    user: str,
    temperature: float = 0.0,
    max_tokens: int | None = None,
    json_mode: bool = False,
) -> LLMResult:
    settings = get_settings()
    if not settings.openrouter_api_key:
        raise LLMUnavailable("OPENROUTER_API_KEY absente")

    payload: dict[str, object] = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens or settings.llm_max_tokens,
    }
    # json_mode : force une sortie JSON stricte (chat XAI v2 → blocs). Le contrat exact
    # est validé en Pydantic côté appelant ; ici on incite juste le modèle au JSON pur.
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    try:
        response = httpx.post(
            f"{OPENROUTER_BASE_URL}/chat/completions",
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "X-Title": "IBIS-X",
            },
            timeout=settings.llm_timeout_seconds,
        )
    except httpx.HTTPError as exc:
        logger.warning("llm.network_error", error=str(exc))
        raise LLMUnavailable(str(exc)) from exc

    if response.status_code != 200:
        logger.warning("llm.http_error", status=response.status_code, body=response.text[:300])
        raise LLMUnavailable(f"HTTP {response.status_code}")

    body = response.json()
    try:
        text = body["choices"][0]["message"]["content"].strip()
        model_used = body.get("model", settings.llm_model)
        tokens_used = int(body.get("usage", {}).get("total_tokens", 0))
    except (KeyError, IndexError, AttributeError) as exc:
        raise LLMUnavailable("Réponse OpenRouter invalide") from exc
    if not text:
        raise LLMUnavailable("Réponse vide")
    return LLMResult(text=text, model_used=model_used, tokens_used=tokens_used)
