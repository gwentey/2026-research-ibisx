"""Unitaires : profiling pandas (types, PII, tokens manquants, sanitizer, suggestions)."""

import math

import pandas as pd
import pytest

from ibis.core.errors import InvalidInputError
from ibis.modules.datasets import profiling


def csv_bytes(text: str) -> bytes:
    return text.strip().encode()


def test_missing_tokens_normalized_single_place() -> None:
    """Les « faux manquants » ('', null, N/A, ?, missing…) deviennent NaN (P3, vocab.py)."""
    df = profiling.read_dataframe(
        csv_bytes("a,b\n1,ok\n2,null\n3,N/A\n4,  \n5,missing\n6,?"), "test.csv"
    )
    assert int(df["b"].isna().sum()) == 5


def test_unnamed_and_empty_columns_dropped() -> None:
    df = profiling.read_dataframe(csv_bytes("x,Unnamed: 1,y\n1,,\n2,,\n3,,"), "t.csv")
    assert list(df.columns) == ["x"]


def test_interpret_dtypes() -> None:
    df = pd.DataFrame(
        {
            "age": [20, 30, 40, 50],
            "species": ["a", "b", "a", "b"],
            "comment": ["texte libre un", "autre phrase", "encore différent", "unique aussi"],
            "flag": [True, False, True, False],
        }
    )
    assert profiling.interpret_dtype(df["age"]) == "numerical"
    assert profiling.interpret_dtype(df["species"]) == "categorical"
    assert profiling.interpret_dtype(df["comment"]) == "text"
    assert profiling.interpret_dtype(df["flag"]) == "boolean"


def test_pii_detection_by_name_and_content() -> None:
    emails = pd.Series(["a@ex.org", "b@ex.org", "c@ex.org"])
    anonymous = pd.Series(["x", "y", "z"])
    assert profiling.detect_pii("email", anonymous) is True  # mot-clé dans le nom
    assert profiling.detect_pii("contact", emails) is True  # contenu email majoritaire
    assert profiling.detect_pii("species", anonymous) is False
    assert profiling.detect_pii("prenom", anonymous) is True


def test_profile_stats_and_examples() -> None:
    df = profiling.read_dataframe(csv_bytes("n,cat\n1,a\n2,b\n,a\n4,a"), "t.csv")
    profile = profiling.profile_dataframe(df)
    assert profile.row_count == 4
    by_name = {c.name: c for c in profile.columns}
    assert by_name["n"].stats["null_count"] == 1
    assert by_name["n"].stats["null_percentage"] == 25.0
    assert by_name["n"].is_nullable is True
    assert by_name["cat"].stats["top_values"][0] == {"value": "a", "count": 3}
    assert by_name["cat"].example_values[0] == "a"


def test_sanitize_json_nan_inf() -> None:
    data = {"a": float("nan"), "b": float("inf"), "c": [1.0, float("nan")], "d": {"e": math.pi}}
    clean = profiling.sanitize_json(data)
    assert clean["a"] is None
    assert clean["b"] is None
    assert clean["c"] == [1.0, None]
    assert clean["d"]["e"] == pytest.approx(math.pi)


def test_unparsable_and_empty_rejected() -> None:
    with pytest.raises(InvalidInputError):
        profiling.read_dataframe(b"\x00\x01\x02", "broken.parquet")
    with pytest.raises(InvalidInputError):
        profiling.read_dataframe(b"", "empty.csv")
    with pytest.raises(InvalidInputError):
        profiling.read_dataframe(b"a,b\n1,2", "unsupported.xml")


def test_domain_and_task_suggestions() -> None:
    assert "education" in profiling.suggest_domains(["student_id", "grade", "school"])
    assert "healthcare" in profiling.suggest_domains(["patient", "glucose", "bmi"])
    df = profiling.read_dataframe(csv_bytes("age,species\n1,a\n2,b\n3,a\n4,b"), "t.csv")
    tasks = profiling.suggest_tasks(profiling.profile_dataframe(df))
    assert "classification" in tasks
    assert "regression" in tasks
