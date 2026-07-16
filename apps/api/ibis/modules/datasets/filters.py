"""Application des filtres du catalogue en SQL (CDC §5.3) — une seule implémentation (P3)."""

from sqlalchemy import Integer, Select, case, cast, func, or_

from ibis.modules.datasets.ethics import ETHICAL_CRITERIA
from ibis.modules.datasets.models import Dataset
from ibis.modules.datasets.schemas import DatasetFilters, SortKey, SortOrder


# Expression SQL du score éthique — MÊME définition que ethics.ethical_score :
# (nb critères à TRUE) / 10. Utilisée uniquement pour filtrer ; l'affichage
# passe toujours par le calcul Python (source unique de vérité côté réponse).
def ethical_score_expression():  # type: ignore[no-untyped-def]
    true_count = sum(
        cast(case((getattr(Dataset, name).is_(True), 1), else_=0), Integer)
        for name in ETHICAL_CRITERIA
    )
    return true_count * 100 / len(ETHICAL_CRITERIA)  # ∈ [0,100]


SORT_COLUMNS = {
    "name": Dataset.display_name,
    "year": Dataset.year,
    "instances": Dataset.instances_number,
    "features": Dataset.features_number,
    "citations": Dataset.num_citations,
    "created": Dataset.created_at,
    "updated": Dataset.updated_at,
}


def apply_filters(query: Select, filters: DatasetFilters) -> Select:
    if filters.q:
        like = f"%{filters.q.strip()}%"
        query = query.where(or_(Dataset.display_name.ilike(like), Dataset.objective.ilike(like)))
    if filters.domains:
        query = query.where(Dataset.domain.contains(filters.domains))  # @> containment (GIN)
    if filters.tasks:
        query = query.where(Dataset.task.contains(filters.tasks))
    if filters.instances_min is not None:
        query = query.where(Dataset.instances_number >= filters.instances_min)
    if filters.instances_max is not None:
        query = query.where(Dataset.instances_number <= filters.instances_max)
    if filters.features_min is not None:
        query = query.where(Dataset.features_number >= filters.features_min)
    if filters.features_max is not None:
        query = query.where(Dataset.features_number <= filters.features_max)
    if filters.year_min is not None:
        query = query.where(Dataset.year >= filters.year_min)
    if filters.year_max is not None:
        query = query.where(Dataset.year <= filters.year_max)
    if filters.citations_min is not None:
        query = query.where(Dataset.num_citations >= filters.citations_min)
    if filters.citations_max is not None:
        query = query.where(Dataset.num_citations <= filters.citations_max)
    if filters.ethical_score_min is not None and filters.ethical_score_min > 0:
        query = query.where(ethical_score_expression() >= filters.ethical_score_min)
    # Toggles : ne filtrent que s'ils sont activés (CDC §5.3)
    if filters.split:
        query = query.where(Dataset.split.is_(True))
    if filters.anonymized:
        query = query.where(Dataset.anonymization_applied.is_(True))
    if filters.temporal:
        query = query.where(Dataset.temporal_factors.is_(True))
    if filters.public:
        query = query.where(Dataset.access == "public")
    if filters.representativity_level:
        query = query.where(Dataset.representativity_level == filters.representativity_level)
    # Tristate explicite : peu importe (None) / avec (True) / sans (False)
    if filters.has_missing_values is not None:
        query = query.where(Dataset.has_missing_values.is_(filters.has_missing_values))
    for criterion in ETHICAL_CRITERIA:
        if getattr(filters, criterion):
            query = query.where(getattr(Dataset, criterion).is_(True))
    return query


def apply_sort(query: Select, sort_by: SortKey, sort_order: SortOrder) -> Select:
    column = SORT_COLUMNS[sort_by]
    ordered = column.desc() if sort_order == "desc" else column.asc()
    # Tri secondaire stable pour une pagination déterministe (P4)
    return query.order_by(ordered.nulls_last(), Dataset.id.asc())


def count_query(filters: DatasetFilters) -> Select:
    from sqlalchemy import select

    return apply_filters(select(func.count(Dataset.id)), filters)
