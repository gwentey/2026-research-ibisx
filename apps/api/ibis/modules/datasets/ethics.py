"""Les 10 critères éthiques (taxonomie Khelifi 2024, CDC §5.2) — source unique (P3).

Cette liste alimente : le modèle SQLAlchemy, le filtre SQL `ethical_score_min`,
le module de scoring (J3) et la grille de conformité du front (via l'OpenAPI).
Tristate : None = non évalué, False = évalué absent, True = présent.
"""

ETHICAL_CRITERIA: tuple[str, ...] = (
    "informed_consent",
    "transparency",
    "user_control",
    "equity_non_discrimination",
    "security_measures_in_place",
    "data_quality_documented",
    "anonymization_applied",
    "record_keeping_policy_exists",
    "purpose_limitation_respected",
    "accountability_defined",
)


def ethical_score(values: dict[str, bool | None]) -> float:
    """Score éthique ∈ [0,1] = (nb critères à True) / 10 — CDC §6.2.

    `None` et `False` comptent 0 (granularité de 10 % par critère).
    """
    return sum(1 for name in ETHICAL_CRITERIA if values.get(name) is True) / len(ETHICAL_CRITERIA)
