"""Routes scoring (CDC §6.5) : POST /datasets/score, GET /score/profiles."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ibis.db.engine import get_db
from ibis.modules.auth.deps import CurrentClaims
from ibis.modules.scoring import formulas, service
from ibis.modules.scoring.schemas import (
    ProfilesResponse,
    ScoreRequest,
    ScoreResponse,
    ScoringProfile,
)

router = APIRouter(tags=["scoring"])

DbDep = Annotated[Session, Depends(get_db)]


@router.post("/datasets/score", response_model=ScoreResponse, operation_id="scoreDatasets")
def score_datasets(payload: ScoreRequest, db: DbDep, _claims: CurrentClaims) -> ScoreResponse:
    """Score de pertinence pondéré + décomposition des 12 critères (CDC §6.3).

    Le backend est l'UNIQUE endroit où ces scores sont calculés (P3).
    """
    return service.score_datasets(db, filters=payload.filters, weights=payload.weights)


@router.get("/score/profiles", response_model=ProfilesResponse, operation_id="getScoringProfiles")
def get_profiles(_claims: CurrentClaims) -> ProfilesResponse:
    """Profils de pondération prédéfinis (CDC §6.4) + poids par défaut."""
    return ProfilesResponse(
        profiles=[
            ScoringProfile(name=name, weights=weights)
            for name, weights in formulas.PROFILES.items()
        ],
        default_weights=dict(formulas.DEFAULT_WEIGHTS),
        criteria=list(formulas.CRITERIA),
    )
