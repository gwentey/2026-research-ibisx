"""Service scoring : applique LES formules à une sélection filtrée de datasets."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from ibis.modules.datasets.filters import apply_filters
from ibis.modules.datasets.models import Dataset
from ibis.modules.datasets.schemas import DatasetFilters
from ibis.modules.datasets.service import to_card
from ibis.modules.scoring import formulas
from ibis.modules.scoring.schemas import CriterionWeight, ScoredDataset, ScoreResponse


def resolve_weights(weights: list[CriterionWeight]) -> dict[str, float]:
    resolved = {w.criterion_name: w.weight for w in weights if w.weight > 0}
    return resolved or dict(formulas.DEFAULT_WEIGHTS)


def score_datasets(
    db: Session, *, filters: DatasetFilters | None, weights: list[CriterionWeight]
) -> ScoreResponse:
    query = select(Dataset)
    if filters is not None:
        query = apply_filters(query, filters)
    datasets = db.scalars(query).all()

    resolved = resolve_weights(weights)
    scored: list[tuple[float, Dataset, dict[str, float]]] = []
    for dataset in datasets:
        facts = formulas.DatasetFacts.from_dataset(dataset)
        decomposition = formulas.criterion_scores(facts)
        final = formulas.weighted_score(decomposition, resolved)
        scored.append((final, dataset, decomposition))

    # Tri décroissant, départage stable par nom (P4 : classement déterministe)
    scored.sort(key=lambda item: (-item[0], item[1].display_name, str(item[1].id)))

    results = [
        ScoredDataset(
            dataset=to_card(dataset),
            score=round(final, 4),
            rank=rank,
            criterion_scores=decomposition,
        )
        for rank, (final, dataset, decomposition) in enumerate(scored, start=1)
    ]
    return ScoreResponse(
        results=results,
        effective_weights=formulas.normalize_weights(resolved),
        criteria=list(formulas.CRITERIA),
    )
