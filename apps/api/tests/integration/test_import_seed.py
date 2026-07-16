"""Intégration : import par configuration YAML (CDC §5.5.a) — réel, idempotent, sans réseau."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from ibis.modules.datasets.importer import default_config_path, import_from_config
from ibis.modules.datasets.models import Dataset


def test_seed_import_is_real_and_idempotent(db_session: Session) -> None:
    config = default_config_path()
    assert config.exists(), "seed_data/datasets.yaml manquant"

    report = import_from_config(db_session, config, only=["iris", "student_performance"])
    assert report.failed == [], report.failed
    assert sorted(report.imported) == ["iris", "student_performance"]

    iris = db_session.scalar(select(Dataset).where(Dataset.dataset_name == "iris"))
    assert iris is not None
    assert iris.created_by is None  # import système
    assert iris.instances_number == 150  # les VRAIES 150 lignes UCI
    assert iris.features_number == 5
    assert iris.domain == ["biology"]
    assert iris.transparency is True
    assert iris.informed_consent is None  # tristate honnête (non applicable → non évalué)

    student = db_session.scalar(
        select(Dataset).where(Dataset.dataset_name == "student_performance")
    )
    assert student is not None
    assert student.instances_number == 395  # student-mat.csv UCI (sép. ';' auto-détecté)
    assert student.features_number == 33

    # Idempotence : relance → tout est ignoré, rien ne casse ([NE PAS REPRODUIRE] S4)
    second = import_from_config(db_session, config, only=["iris", "student_performance"])
    assert second.imported == []
    assert sorted(second.skipped) == ["iris", "student_performance"]
    assert second.failed == []
