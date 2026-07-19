"""Tests du calcul d'équité par groupe (fonction pure, sans I/O)."""

import pytest

from ibis.core.errors import InvalidInputError
from ibis.modules.xai.fairness import compute_group_fairness


def _by_value(report):
    return {g["value"]: g for g in report["groups"]}


def test_binary_detects_disparity():
    groups = ["A", "A", "A", "A", "B", "B", "B", "B"]
    y_true = ["oui", "non", "oui", "non", "oui", "non", "oui", "non"]
    y_pred = ["oui", "oui", "oui", "non", "oui", "non", "non", "non"]

    report = compute_group_fairness(y_true, y_pred, groups)

    assert report["binary"] is True
    assert report["favorable"] == "oui"  # dernière classe triée par défaut
    g = _by_value(report)
    assert g["A"]["selection_rate"] == pytest.approx(0.75)
    assert g["B"]["selection_rate"] == pytest.approx(0.25)
    assert g["A"]["tpr"] == pytest.approx(1.0)
    assert g["B"]["tpr"] == pytest.approx(0.5)
    d = report["disparities"]
    assert d["selection_rate_ratio"] == pytest.approx(0.25 / 0.75)
    assert d["tpr_gap"] == pytest.approx(0.5)
    assert d["four_fifths_pass"] is False  # 0.33 < 0.8


def test_perfect_parity_passes_four_fifths():
    groups = ["A", "A", "B", "B"]
    y_true = ["non", "oui", "non", "oui"]
    y_pred = ["non", "oui", "non", "oui"]

    d = compute_group_fairness(y_true, y_pred, groups)["disparities"]
    assert d["selection_rate_ratio"] == pytest.approx(1.0)
    assert d["four_fifths_pass"] is True
    assert d["tpr_gap"] == pytest.approx(0.0)
    assert d["accuracy_gap"] == pytest.approx(0.0)


def test_favorable_override():
    groups = ["A", "A", "B", "B"]
    y_true = ["non", "oui", "non", "oui"]
    y_pred = ["non", "non", "non", "non"]
    report = compute_group_fairness(y_true, y_pred, groups, favorable="non")
    assert report["favorable"] == "non"
    g = _by_value(report)
    assert g["A"]["selection_rate"] == pytest.approx(1.0)  # tout prédit « non »


def test_multiclass_only_accuracy():
    groups = ["A", "A", "A", "B", "B", "B"]
    y_true = ["x", "y", "z", "x", "y", "z"]
    y_pred = ["x", "y", "z", "x", "x", "x"]  # B moins bon

    report = compute_group_fairness(y_true, y_pred, groups)
    assert report["binary"] is False
    g = _by_value(report)
    assert "selection_rate" not in g["A"]
    assert g["A"]["accuracy"] == pytest.approx(1.0)
    assert g["B"]["accuracy"] == pytest.approx(1 / 3)
    assert report["disparities"]["accuracy_gap"] == pytest.approx(2 / 3)
    assert "selection_rate_ratio" not in report["disparities"]


def test_length_mismatch_raises():
    with pytest.raises(InvalidInputError):
        compute_group_fairness(["a", "b"], ["a"], ["A", "B"])
