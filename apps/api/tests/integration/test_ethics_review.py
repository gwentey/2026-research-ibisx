"""Validation humaine des critères éthiques suggérés par l'IA.

Une suggestion ne vaut rien tant qu'un humain ne l'a pas confirmée : c'est seulement à ce
moment que les critères peuvent compter dans `ethical_score`.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from ibis.modules.auth.models import User, UserRole
from ibis.modules.datasets.ethics import ETHICAL_CRITERIA
from ibis.modules.datasets.models import Dataset

SUGGESTIONS = {
    "values": {"transparency": True, "data_quality_documented": True},
    "notes": {"transparency": "Licence CC0 et documentation publique."},
    "model_used": "test-model",
    "is_fallback": False,
}


def register(client: TestClient, db: Session, email: str, role: UserRole) -> tuple[dict, uuid.UUID]:
    client.post("/api/v1/auth/register", json={"email": email, "password": "s3cret-pass"})
    user = db.query(User).filter(User.email == email).one()
    user.role = role
    db.commit()
    login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "s3cret-pass"}
    ).json()
    return {"Authorization": f"Bearer {login['access_token']}"}, user.id


def make_dataset(db: Session, *, owner_id: uuid.UUID | None, slug: str = "imported") -> Dataset:
    dataset = Dataset(
        dataset_name=slug,
        display_name="Jeu importé",
        access="public",
        source_kind="kaggle",
        source_ref=f"kaggle:someone/{slug}",
        created_by=owner_id,
        ethics_suggestions=SUGGESTIONS,
    )
    db.add(dataset)
    db.commit()
    return dataset


class TestEthicsReview:
    def test_should_apply_confirmed_values_and_stamp_the_reviewer(
        self, client: TestClient, db_session: Session
    ) -> None:
        headers, user_id = register(client, db_session, "owner@ex.org", UserRole.contributor)
        dataset = make_dataset(db_session, owner_id=user_id)

        response = client.post(
            f"/api/v1/datasets/{dataset.id}/ethics-review",
            json={"values": {"transparency": True, "anonymization_applied": False}},
            headers=headers,
        )

        assert response.status_code == 200
        body = response.json()
        assert body["ethical_criteria"]["transparency"] is True
        assert body["ethical_criteria"]["anonymization_applied"] is False
        assert body["ethics_reviewed_at"] is not None

        db_session.refresh(dataset)
        assert dataset.ethics_reviewed_by == user_id

    def test_should_count_confirmed_criteria_in_the_ethical_score(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Avant validation le score est à zéro ; après, il reflète ce que l'humain a confirmé."""
        headers, user_id = register(client, db_session, "owner2@ex.org", UserRole.contributor)
        dataset = make_dataset(db_session, owner_id=user_id, slug="scored")

        before = client.get(f"/api/v1/datasets/{dataset.id}", headers=headers).json()
        assert before["ethical_score"] == 0  # les suggestions ne comptent pas

        response = client.post(
            f"/api/v1/datasets/{dataset.id}/ethics-review",
            json={"values": {"transparency": True, "data_quality_documented": True}},
            headers=headers,
        )

        assert response.json()["ethical_score"] == pytest.approx(0.2)

    def test_should_let_the_reviewer_contradict_the_ai(
        self, client: TestClient, db_session: Session
    ) -> None:
        """L'humain tranche : il peut refuser une suggestion, pas seulement l'entériner."""
        headers, user_id = register(client, db_session, "owner3@ex.org", UserRole.contributor)
        dataset = make_dataset(db_session, owner_id=user_id, slug="contradicted")

        response = client.post(
            f"/api/v1/datasets/{dataset.id}/ethics-review",
            json={"values": {"transparency": False}},  # l'IA suggérait True
            headers=headers,
        )

        assert response.json()["ethical_criteria"]["transparency"] is False
        assert response.json()["ethical_score"] == 0

    def test_should_accept_leaving_a_criterion_undecided(
        self, client: TestClient, db_session: Session
    ) -> None:
        headers, user_id = register(client, db_session, "owner4@ex.org", UserRole.contributor)
        dataset = make_dataset(db_session, owner_id=user_id, slug="undecided")

        response = client.post(
            f"/api/v1/datasets/{dataset.id}/ethics-review",
            json={"values": {"transparency": True, "user_control": None}},
            headers=headers,
        )

        criteria = response.json()["ethical_criteria"]
        assert criteria["transparency"] is True
        assert criteria["user_control"] is None

    def test_should_reject_an_unknown_criterion(
        self, client: TestClient, db_session: Session
    ) -> None:
        headers, user_id = register(client, db_session, "owner5@ex.org", UserRole.contributor)
        dataset = make_dataset(db_session, owner_id=user_id, slug="unknown-key")

        response = client.post(
            f"/api/v1/datasets/{dataset.id}/ethics-review",
            json={"values": {"transparency": True, "critere_invente": True}},
            headers=headers,
        )

        assert response.status_code == 422

    def test_should_not_touch_criteria_absent_from_the_payload(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Une revue partielle ne doit pas écraser en NULL ce qui n'est pas envoyé."""
        headers, user_id = register(client, db_session, "owner6@ex.org", UserRole.contributor)
        dataset = make_dataset(db_session, owner_id=user_id, slug="partial")
        dataset.informed_consent = True
        db_session.commit()

        response = client.post(
            f"/api/v1/datasets/{dataset.id}/ethics-review",
            json={"values": {"transparency": True}},
            headers=headers,
        )

        assert response.json()["ethical_criteria"]["informed_consent"] is True

    def test_should_refuse_someone_who_does_not_own_the_dataset(
        self, client: TestClient, db_session: Session
    ) -> None:
        _, owner_id = register(client, db_session, "real-owner@ex.org", UserRole.contributor)
        dataset = make_dataset(db_session, owner_id=owner_id, slug="not-yours")
        intruder_headers, _ = register(client, db_session, "intruder@ex.org", UserRole.contributor)

        response = client.post(
            f"/api/v1/datasets/{dataset.id}/ethics-review",
            json={"values": {"transparency": True}},
            headers=intruder_headers,
        )

        assert response.status_code == 403

    def test_should_allow_an_admin_on_any_dataset(
        self, client: TestClient, db_session: Session
    ) -> None:
        _, owner_id = register(client, db_session, "owner7@ex.org", UserRole.contributor)
        dataset = make_dataset(db_session, owner_id=owner_id, slug="admin-review")
        admin_headers, admin_id = register(client, db_session, "admin@ex.org", UserRole.admin)

        response = client.post(
            f"/api/v1/datasets/{dataset.id}/ethics-review",
            json={"values": {"transparency": True}},
            headers=admin_headers,
        )

        assert response.status_code == 200
        db_session.refresh(dataset)
        assert dataset.ethics_reviewed_by == admin_id

    def test_should_expose_every_criterion_so_the_form_can_render(
        self, client: TestClient, db_session: Session
    ) -> None:
        headers, user_id = register(client, db_session, "owner8@ex.org", UserRole.contributor)
        dataset = make_dataset(db_session, owner_id=user_id, slug="form")

        detail = client.get(f"/api/v1/datasets/{dataset.id}", headers=headers).json()

        assert set(detail["ethical_criteria"]) == set(ETHICAL_CRITERIA)
        assert detail["ethics_suggestions"]["values"]["transparency"] is True
        assert detail["ethics_reviewed_at"] is None
