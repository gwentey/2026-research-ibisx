"""Intégration : import Kaggle par lien collé — validation, RBAC, déduplication.

La tâche Celery n'est pas exécutée ici (elle est simulée) : on teste ce que la ROUTE
garantit de façon synchrone, c'est-à-dire ce que l'utilisateur voit immédiatement.
"""

import io
import zipfile

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from ibis.modules.auth.models import User, UserRole
from ibis.modules.datasets import kaggle_import
from ibis.modules.datasets.kaggle_client import KaggleClient, KaggleRef
from ibis.modules.datasets.models import Dataset

IRIS_CSV = "sepal_length,sepal_width,species\n5.1,3.5,setosa\n4.9,3.0,setosa\n6.2,3.4,virginica\n"


def promote(client: TestClient, db: Session, email: str, role: UserRole) -> dict[str, str]:
    client.post("/api/v1/auth/register", json={"email": email, "password": "s3cret-pass"})
    user = db.query(User).filter(User.email == email).one()
    user.role = role
    db.commit()
    login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "s3cret-pass"}
    ).json()
    return {"Authorization": f"Bearer {login['access_token']}"}


@pytest.fixture()
def no_celery(monkeypatch: pytest.MonkeyPatch) -> list[tuple]:
    """Intercepte l'envoi Celery : on vérifie les ARGUMENTS, sans worker."""
    sent: list[tuple] = []
    monkeypatch.setattr(
        "ibis.modules.datasets.routes.import_kaggle_task.delay",
        lambda *args: sent.append(args),
    )
    return sent


class TestImportRoute:
    def test_should_accept_a_kaggle_link_and_queue_the_import(
        self, client: TestClient, db_session: Session, no_celery: list[tuple]
    ) -> None:
        headers = promote(client, db_session, "contrib@ex.org", UserRole.contributor)

        response = client.post(
            "/api/v1/datasets/import/kaggle",
            json={
                "url": "https://www.kaggle.com/datasets/uciml/iris?select=Iris.csv",
                "access": "public",
            },
            headers=headers,
        )

        assert response.status_code == 202
        body = response.json()
        assert body["ref"] == "uciml/iris"
        assert body["job"]["status"] == "pending"
        assert body["existing_dataset_id"] is None
        # La tâche part avec la référence DÉJÀ résolue : le worker ne re-parse pas l'URL.
        assert no_celery[0][1:4] == ("uciml", "iris", "public")

    def test_should_reject_a_link_that_is_not_a_kaggle_dataset(
        self, client: TestClient, db_session: Session, no_celery: list[tuple]
    ) -> None:
        headers = promote(client, db_session, "contrib2@ex.org", UserRole.contributor)

        response = client.post(
            "/api/v1/datasets/import/kaggle",
            json={"url": "https://www.kaggle.com/competitions/titanic"},
            headers=headers,
        )

        assert response.status_code == 422
        assert not no_celery, "aucun job ne doit partir sur un lien invalide"

    def test_should_refuse_an_anonymous_visitor(self, client: TestClient) -> None:
        response = client.post(
            "/api/v1/datasets/import/kaggle",
            json={"url": "https://www.kaggle.com/datasets/uciml/iris"},
        )
        assert response.status_code in (401, 403)

    def test_should_accept_a_plain_signed_in_account(
        self, client: TestClient, db_session: Session, no_celery: list[tuple]
    ) -> None:
        """Ouvert à TOUT compte connecté, contrairement à l'upload libre (contributor+).

        L'import Kaggle est plus contraint qu'un upload : source publique identifiée,
        licence vérifiée, taille plafonnée, attribution nominative.
        """
        headers = promote(client, db_session, "membre@ex.org", UserRole.user)

        response = client.post(
            "/api/v1/datasets/import/kaggle",
            json={"url": "https://www.kaggle.com/datasets/uciml/iris"},
            headers=headers,
        )

        assert response.status_code == 202
        assert no_celery, "l'import doit partir pour un compte simple aussi"

    def test_should_still_reserve_free_upload_to_contributors(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Garde-fou : ouvrir l'import ne doit PAS avoir ouvert l'upload libre."""
        headers = promote(client, db_session, "membre2@ex.org", UserRole.user)

        response = client.post(
            "/api/v1/datasets",
            files={"files": ("d.csv", b"a,b\n1,2\n", "text/csv")},
            data={"metadata": '{"display_name": "Tentative"}'},
            headers=headers,
        )

        assert response.status_code == 403


class TestDeduplication:
    def _seed_imported(self, db: Session, *, access: str, owner_id=None) -> Dataset:
        dataset = Dataset(
            dataset_name=f"iris_{access}_{owner_id or 'sys'}",
            display_name="Iris",
            access=access,
            source_kind="kaggle",
            source_ref="kaggle:uciml/iris",
            created_by=owner_id,
        )
        db.add(dataset)
        db.commit()
        return dataset

    def test_should_return_the_existing_public_dataset_instead_of_a_duplicate(
        self, client: TestClient, db_session: Session, no_celery: list[tuple]
    ) -> None:
        existing = self._seed_imported(db_session, access="public")
        headers = promote(client, db_session, "contrib3@ex.org", UserRole.contributor)

        response = client.post(
            "/api/v1/datasets/import/kaggle",
            json={"url": "https://www.kaggle.com/datasets/uciml/iris"},
            headers=headers,
        )

        assert response.status_code == 202
        assert response.json()["existing_dataset_id"] == str(existing.id)
        assert not no_celery, "un doublon ne doit pas relancer un téléchargement"

    def test_should_not_reveal_someone_elses_private_copy(
        self, client: TestClient, db_session: Session, no_celery: list[tuple]
    ) -> None:
        """La copie privée d'autrui ne doit ni bloquer ni fuiter."""
        other = db_session.query(User).first()
        stranger_id = other.id if other else None
        self._seed_imported(db_session, access="private", owner_id=stranger_id)

        headers = promote(client, db_session, "contrib4@ex.org", UserRole.contributor)
        response = client.post(
            "/api/v1/datasets/import/kaggle",
            json={"url": "https://www.kaggle.com/datasets/uciml/iris"},
            headers=headers,
        )

        assert response.status_code == 202
        assert response.json()["existing_dataset_id"] is None
        assert no_celery, "l'import doit bien partir : ce n'est pas MON doublon"


class TestRunImport:
    """Le chemin worker, avec un faux Kaggle — vérifie ce qui atterrit vraiment en base."""

    def _client(self, *, license_name: str = "CC0-1.0") -> KaggleClient:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("Iris.csv", IRIS_CSV)
        archive_bytes = buffer.getvalue()

        def handler(request: httpx.Request) -> httpx.Response:
            if "view" in request.url.path:
                return httpx.Response(
                    200,
                    json={
                        "title": "Iris Species",
                        "subtitle": "Classify iris plants",
                        "licenseName": license_name,
                        "totalBytes": len(archive_bytes),
                        "keywords": ["biology"],
                    },
                )
            return httpx.Response(200, content=archive_bytes)

        return KaggleClient(username="u", key="k", transport=httpx.MockTransport(handler))

    def test_should_create_a_community_dataset_with_attribution(self, real_db: Session) -> None:
        user = User(email="importer@ex.org", hashed_password="x", role=UserRole.contributor)
        real_db.add(user)
        real_db.commit()

        dataset = kaggle_import.run_import(
            real_db,
            ref=KaggleRef("uciml", "iris"),
            access_requested="public",
            user_id=user.id,
            client=self._client(),
        )

        assert dataset.source_ref == "kaggle:uciml/iris"
        assert dataset.source_kind == "kaggle"
        assert dataset.license_name == "CC0-1.0"
        assert dataset.created_by == user.id
        assert dataset.is_verified is False  # communauté, jamais vérifié d'office
        assert dataset.access == "public"
        assert dataset.files, "les fichiers doivent être stockés"

    def test_should_expose_the_importer_pseudo_on_the_catalogue_card(
        self, real_db: Session
    ) -> None:
        """L'attribution doit survivre à la sérialisation — c'est elle qui dissuade les trolls."""
        from ibis.modules.datasets.service import to_card

        user = User(
            email="chercheuse@ex.org",
            hashed_password="x",
            role=UserRole.contributor,
            pseudo="Camille",
        )
        real_db.add(user)
        real_db.commit()

        dataset = kaggle_import.run_import(
            real_db,
            ref=KaggleRef("uciml", "iris-attributed"),
            access_requested="public",
            user_id=user.id,
            client=self._client(),
        )

        card = to_card(dataset)
        assert card.owner is not None
        assert card.owner.pseudo == "Camille"
        assert card.owner.id == user.id
        assert card.is_verified is False
        # L'email ne doit JAMAIS transiter par la carte publique.
        assert "chercheuse@ex.org" not in card.model_dump_json()

    def test_should_leave_every_ethical_criterion_unset(self, real_db: Session) -> None:
        """L'invariant du produit, vérifié de bout en bout jusqu'à la base."""
        from ibis.modules.datasets.ethics import ETHICAL_CRITERIA

        dataset = kaggle_import.run_import(
            real_db,
            ref=KaggleRef("uciml", "iris2"),
            access_requested="public",
            user_id=None,
            client=self._client(),
        )

        for criterion in ETHICAL_CRITERIA:
            assert getattr(dataset, criterion) is None, criterion
        assert dataset.ethical_values() == dict.fromkeys(ETHICAL_CRITERIA, None)

    def test_should_downgrade_to_private_when_the_license_forbids_redistribution(
        self, real_db: Session
    ) -> None:
        dataset = kaggle_import.run_import(
            real_db,
            ref=KaggleRef("uciml", "iris3"),
            access_requested="public",
            user_id=None,
            client=self._client(license_name="CC BY-NC-SA 4.0"),
        )

        assert dataset.access == "private"
        assert dataset.license_name == "CC BY-NC-SA 4.0"

    def test_should_give_a_unique_slug_to_homonymous_datasets(self, real_db: Session) -> None:
        first = kaggle_import.run_import(
            real_db,
            ref=KaggleRef("owner-a", "iris"),
            access_requested="private",
            user_id=None,
            client=self._client(),
        )
        second = kaggle_import.run_import(
            real_db,
            ref=KaggleRef("owner-b", "iris"),
            access_requested="private",
            user_id=None,
            client=self._client(),
        )

        assert first.dataset_name != second.dataset_name
