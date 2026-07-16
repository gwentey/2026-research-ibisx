"""Vocabulaire canonique UNIQUE du nettoyage (P3 — CDC §8.2 É3).

[NE PAS REPRODUIRE] la v1 : 4 vocabulaires divergents, alias silencieux
(linear/spline/ffill → median). Ici : une liste fermée, zéro alias.
Utilisé par le profiling des datasets (J2), l'analyse qualité et le
preprocessing du worker (J5).
"""

# Tokens de « faux manquants » normalisés en NaN — appliqué à UN seul endroit.
MISSING_VALUE_TOKENS: frozenset[str] = frozenset(
    {
        "",
        "null",
        "none",
        "nan",
        "n/a",
        "na",
        "#n/a",
        "#na",
        "undefined",
        "missing",
        "?",
        "-",
        "--",
    }
)

# Les 8 stratégies canoniques de traitement des manquants (CDC §8.2 É3).
CANONICAL_STRATEGIES: tuple[str, ...] = (
    "mean",
    "median",
    "most_frequent",
    "constant",
    "knn",
    "iterative",
    "drop_rows",
    "drop_column",
)


def is_missing_token(value: object) -> bool:
    return isinstance(value, str) and value.strip().lower() in MISSING_VALUE_TOKENS
