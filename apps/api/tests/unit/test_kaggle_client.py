"""Client Kaggle — parsing d'URL, métadonnées, licence, plafond de taille.

Aucun appel réseau réel : le transport httpx est simulé.
"""

import io
import zipfile

import httpx
import pytest

from ibis.core.errors import InvalidInputError
from ibis.modules.datasets.kaggle_client import (
    KaggleClient,
    KaggleRef,
    license_allows_redistribution,
    parse_kaggle_url,
)


class TestParseKaggleUrl:
    """Un chercheur colle l'URL telle qu'il la voit dans son navigateur."""

    @pytest.mark.parametrize(
        "url",
        [
            "https://www.kaggle.com/datasets/uciml/iris",
            "https://kaggle.com/datasets/uciml/iris",
            "http://www.kaggle.com/datasets/uciml/iris",
            "https://www.kaggle.com/datasets/uciml/iris/",
            "https://www.kaggle.com/datasets/uciml/iris/data",
            "https://www.kaggle.com/datasets/uciml/iris/versions/2",
            "https://www.kaggle.com/datasets/uciml/iris?select=Iris.csv",
            "https://www.kaggle.com/datasets/uciml/iris/data?select=Iris.csv",
            "  https://www.kaggle.com/datasets/uciml/iris  ",
            "www.kaggle.com/datasets/uciml/iris",
            "https://www.kaggle.com/uciml/iris",  # ancienne forme, sans /datasets
            "uciml/iris",  # référence nue (celle du YAML de seed)
        ],
    )
    def test_should_extract_owner_and_slug_from_every_url_form(self, url: str) -> None:
        assert parse_kaggle_url(url) == KaggleRef(owner="uciml", slug="iris")

    def test_should_preserve_hyphens_and_dots_in_slug(self) -> None:
        ref = parse_kaggle_url("https://www.kaggle.com/datasets/mlg-ulb/creditcard-fraud.v2")
        assert ref == KaggleRef(owner="mlg-ulb", slug="creditcard-fraud.v2")

    def test_should_expose_canonical_ref_and_url(self) -> None:
        ref = parse_kaggle_url("https://www.kaggle.com/datasets/uciml/iris?select=Iris.csv")
        assert ref.ref == "uciml/iris"
        assert ref.url == "https://www.kaggle.com/datasets/uciml/iris"

    @pytest.mark.parametrize(
        "url",
        [
            "",
            "   ",
            "https://example.com/datasets/uciml/iris",
            "https://www.kaggle.com/competitions/titanic",  # compétition, pas dataset
            "https://www.kaggle.com/code/uciml/notebook",  # notebook
            "https://www.kaggle.com/datasets/uciml",  # slug manquant
            "not a url at all",
        ],
    )
    def test_should_reject_anything_that_is_not_a_kaggle_dataset(self, url: str) -> None:
        with pytest.raises(InvalidInputError):
            parse_kaggle_url(url)

    @pytest.mark.parametrize(
        "url,expected_word",
        [
            ("https://www.kaggle.com/code/amirmotefaker/supply-chain-analysis/", "notebook"),
            ("https://www.kaggle.com/competitions/titanic", "compétition"),
            ("https://www.kaggle.com/models/google/gemma", "modèle"),
        ],
    )
    def test_should_name_the_wrong_page_kind_in_plain_words(
        self, url: str, expected_word: str
    ) -> None:
        """« Ce lien pointe vers « code » » ne dit rien à personne : il faut nommer la chose."""
        with pytest.raises(InvalidInputError) as caught:
            parse_kaggle_url(url)

        assert expected_word in str(caught.value)
        assert "/datasets/" in str(caught.value)  # et dire où aller


class TestLicenseRedistribution:
    """Le catalogue public redistribue : on n'y met que ce qui l'autorise."""

    @pytest.mark.parametrize(
        "name",
        [
            "CC0-1.0",
            "CC BY 4.0",
            "Attribution 4.0 International (CC BY 4.0)",
            "CC BY-SA 4.0",
            "ODbL-1.0",
            "Database: Open Database, Contents: Database Contents",
            "MIT",
            "Apache 2.0",
        ],
    )
    def test_should_allow_open_licenses(self, name: str) -> None:
        assert license_allows_redistribution(name) is True

    @pytest.mark.parametrize(
        "name",
        [
            "CC BY-NC-SA 4.0",  # non commercial
            "CC BY-NC 4.0",
            "Other (specified in description)",
            "unknown",
            "Original Authors",
            "Subject to the terms of the source",
            "",
            None,
        ],
    )
    def test_should_refuse_unclear_or_restricted_licenses(self, name: str | None) -> None:
        """Défaut conservateur : ce qui n'est pas clairement ouvert force le mode privé."""
        assert license_allows_redistribution(name) is False


def _zip_bytes(files: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return buffer.getvalue()


def _client_with(handler) -> KaggleClient:
    transport = httpx.MockTransport(handler)
    return KaggleClient(username="u", key="k", transport=transport)


class TestKaggleClientView:
    def test_should_return_metadata_needed_for_enrichment(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/api/v1/datasets/view/uciml/iris"
            assert request.headers["authorization"].startswith("Basic ")
            return httpx.Response(
                200,
                json={
                    "title": "Iris Species",
                    "subtitle": "Classify iris plants",
                    "description": "The Iris dataset was used in Fisher's classic paper.",
                    "licenseName": "CC0-1.0",
                    "totalBytes": 15347,
                    "keywords": ["biology", "classification"],
                    "usabilityRating": 0.88,
                },
            )

        meta = _client_with(handler).view(KaggleRef("uciml", "iris"))

        assert meta.title == "Iris Species"
        assert meta.subtitle == "Classify iris plants"
        assert meta.license_name == "CC0-1.0"
        assert meta.total_bytes == 15347
        assert meta.tags == ["biology", "classification"]
        assert meta.redistributable is True

    def test_should_mark_restricted_license_as_not_redistributable(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"title": "X", "licenseName": "CC BY-NC-SA 4.0"})

        assert _client_with(handler).view(KaggleRef("a", "b")).redistributable is False

    def test_should_raise_clear_error_when_dataset_does_not_exist(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(404, text="Not Found")

        with pytest.raises(InvalidInputError, match="introuvable"):
            _client_with(handler).view(KaggleRef("nobody", "nothing"))

    def test_should_raise_clear_error_when_credentials_are_rejected(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(401, text="Unauthorized")

        with pytest.raises(InvalidInputError, match=r"(?i)identifiants kaggle"):
            _client_with(handler).view(KaggleRef("a", "b"))

    def test_should_refuse_a_dataset_over_the_size_cap_before_downloading(self) -> None:
        """Le plafond se lit sur totalBytes : on ne télécharge jamais pour découvrir la taille."""

        def handler(request: httpx.Request) -> httpx.Response:
            assert "download" not in request.url.path, "aucun téléchargement ne doit être tenté"
            return httpx.Response(
                200, json={"title": "Huge", "licenseName": "CC0-1.0", "totalBytes": 3_000_000_000}
            )

        client = _client_with(handler)
        with pytest.raises(InvalidInputError, match="volumineux"):
            client.ensure_within_size_cap(client.view(KaggleRef("a", "b")), max_bytes=200_000_000)


class TestKaggleClientDownload:
    def test_should_return_csv_files_from_the_archive(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/api/v1/datasets/download/uciml/iris"
            return httpx.Response(200, content=_zip_bytes({"Iris.csv": "a,b\n1,2\n"}))

        files = _client_with(handler).download(KaggleRef("uciml", "iris"))

        assert [name for name, _ in files] == ["Iris.csv"]
        assert files[0][1] == b"a,b\n1,2\n"

    def test_should_ignore_non_tabular_members(self) -> None:
        archive = _zip_bytes(
            {"data.csv": "a\n1\n", "readme.txt": "hello", "img/photo.png": "binary"}
        )

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, content=archive)

        files = _client_with(handler).download(KaggleRef("a", "b"))
        assert [name for name, _ in files] == ["data.csv"]

    def test_should_fail_when_archive_holds_no_tabular_file(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, content=_zip_bytes({"readme.txt": "hello"}))

        with pytest.raises(InvalidInputError, match="aucun fichier tabulaire"):
            _client_with(handler).download(KaggleRef("a", "b"))

    def test_should_reject_a_zip_bomb_by_uncompressed_size(self) -> None:
        """Le plafond porte sur la taille DÉCOMPRESSÉE, pas sur celle de l'archive."""
        archive = _zip_bytes({"big.csv": "x" * 5_000_000})

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, content=archive)

        with pytest.raises(InvalidInputError, match="volumineux"):
            _client_with(handler).download(KaggleRef("a", "b"), max_bytes=1_000_000)

    def test_should_reject_path_traversal_members(self) -> None:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("../../etc/evil.csv", "a\n1\n")

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, content=buffer.getvalue())

        with pytest.raises(InvalidInputError):
            _client_with(handler).download(KaggleRef("a", "b"))


class TestKaggleClientAuth:
    def test_should_prefer_bearer_token_over_legacy_credentials(self) -> None:
        seen: dict[str, str] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            seen["auth"] = request.headers["authorization"]
            return httpx.Response(200, json={"title": "X", "licenseName": "CC0-1.0"})

        client = KaggleClient(
            username="u", key="k", api_token="tok", transport=httpx.MockTransport(handler)
        )
        client.view(KaggleRef("a", "b"))

        assert seen["auth"] == "Bearer tok"

    def test_should_require_at_least_one_credential(self) -> None:
        with pytest.raises(InvalidInputError, match=r"(?i)identifiants kaggle"):
            KaggleClient(username="", key="", api_token="")
