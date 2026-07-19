"""Résolution d'un lien de notebook Kaggle vers le(s) dataset(s) qu'il utilise.

Un utilisateur qui cherche un jeu de données tombe très souvent sur un notebook : c'est ce que
Google et Kaggle mettent en avant. Le dataset y figure sous « Input », mais rien n'indique
qu'il faut cliquer dessus pour récupérer son URL. Plutôt que de lui apprendre à naviguer, on
résout le notebook pour lui.
"""

import httpx
import pytest

from ibis.core.errors import InvalidInputError
from ibis.modules.datasets.kaggle_client import (
    KaggleClient,
    KaggleRef,
    KernelRef,
    parse_kaggle_link,
)


class TestParseKaggleLink:
    """`parse_kaggle_link` accepte les deux natures de page et dit laquelle c'est."""

    def test_should_recognise_a_dataset_url(self) -> None:
        assert parse_kaggle_link("https://www.kaggle.com/datasets/uciml/iris") == KaggleRef(
            "uciml", "iris"
        )

    @pytest.mark.parametrize(
        "url",
        [
            "https://www.kaggle.com/code/amirmotefaker/supply-chain-analysis/",
            "https://www.kaggle.com/code/amirmotefaker/supply-chain-analysis/notebook",
            "https://www.kaggle.com/code/amirmotefaker/supply-chain-analysis?scriptVersionId=1",
            "https://www.kaggle.com/kernels/amirmotefaker/supply-chain-analysis",
        ],
    )
    def test_should_recognise_a_notebook_url(self, url: str) -> None:
        assert parse_kaggle_link(url) == KernelRef("amirmotefaker", "supply-chain-analysis")

    def test_should_still_reject_a_competition(self) -> None:
        with pytest.raises(InvalidInputError, match="compétition"):
            parse_kaggle_link("https://www.kaggle.com/competitions/titanic")


def _client(handler) -> KaggleClient:
    return KaggleClient(username="u", key="k", transport=httpx.MockTransport(handler))


class TestKernelDatasetSources:
    def test_should_return_the_single_dataset_a_notebook_uses(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert "/api/v1/kernels/pull" in request.url.path
            assert request.url.params["user_name"] == "amirmotefaker"
            assert request.url.params["kernel_slug"] == "supply-chain-analysis"
            return httpx.Response(
                200,
                json={
                    "metadata": {
                        "datasetDataSources": [{"reference": "amirmotefaker/supply-chain-dataset"}]
                    }
                },
            )

        refs = _client(handler).kernel_dataset_sources(
            KernelRef("amirmotefaker", "supply-chain-analysis")
        )

        assert refs == [KaggleRef("amirmotefaker", "supply-chain-dataset")]

    @pytest.mark.parametrize(
        "payload",
        [
            # L'API a plusieurs formes selon la version : on accepte les variantes plutôt
            # que de parier sur une seule (le contrat n'est pas documenté publiquement).
            {"metadata": {"datasetDataSources": [{"reference": "a/b"}]}},
            {"metadata": {"dataset_sources": ["a/b"]}},
            {"metadata": {"datasetDataSources": ["a/b"]}},
            {"datasetDataSources": [{"reference": "a/b"}]},
            {"dataset_sources": ["a/b"]},
        ],
    )
    def test_should_tolerate_every_known_payload_shape(self, payload: dict) -> None:
        refs = _client(lambda _r: httpx.Response(200, json=payload)).kernel_dataset_sources(
            KernelRef("x", "y")
        )
        assert refs == [KaggleRef("a", "b")]

    def test_should_return_several_datasets_when_the_notebook_uses_several(self) -> None:
        payload = {
            "metadata": {
                "datasetDataSources": [
                    {"reference": "alice/first"},
                    {"reference": "bob/second"},
                ]
            }
        }
        refs = _client(lambda _r: httpx.Response(200, json=payload)).kernel_dataset_sources(
            KernelRef("x", "y")
        )
        assert refs == [KaggleRef("alice", "first"), KaggleRef("bob", "second")]

    def test_should_return_empty_when_the_notebook_uses_no_dataset(self) -> None:
        """Un notebook peut n'utiliser qu'une compétition, ou rien du tout."""
        refs = _client(
            lambda _r: httpx.Response(200, json={"metadata": {"datasetDataSources": []}})
        ).kernel_dataset_sources(KernelRef("x", "y"))
        assert refs == []

    def test_should_return_empty_rather_than_crash_on_an_unknown_shape(self) -> None:
        """Contrat non documenté : en cas de surprise, on dégrade, on ne casse pas l'import."""
        refs = _client(
            lambda _r: httpx.Response(200, json={"something": "unexpected"})
        ).kernel_dataset_sources(KernelRef("x", "y"))
        assert refs == []

    def test_should_ignore_entries_that_are_not_a_valid_reference(self) -> None:
        payload = {
            "metadata": {
                "datasetDataSources": [
                    {"reference": "alice/good"},
                    {"reference": "pas-de-slash"},
                    {"nope": 1},
                    None,
                ]
            }
        }
        refs = _client(lambda _r: httpx.Response(200, json=payload)).kernel_dataset_sources(
            KernelRef("x", "y")
        )
        assert refs == [KaggleRef("alice", "good")]

    def test_should_raise_a_readable_error_when_the_notebook_does_not_exist(self) -> None:
        with pytest.raises(InvalidInputError, match="introuvable"):
            _client(lambda _r: httpx.Response(404, text="Not Found")).kernel_dataset_sources(
                KernelRef("nobody", "nothing")
            )
