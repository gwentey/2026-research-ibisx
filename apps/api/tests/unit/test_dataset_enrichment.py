"""Enrichissement d'un dataset importé depuis Kaggle.

Invariant central : l'IA PROPOSE les critères éthiques, elle ne les inscrit jamais.
Les 10 critères du dataset restent NULL tant qu'un humain n'a pas tranché — sinon le score
éthique, qui est la valeur du produit, serait gonflé par des suppositions.
"""

import pytest

from ibis.modules.datasets import enrichment
from ibis.modules.datasets.ethics import ETHICAL_CRITERIA
from ibis.modules.datasets.kaggle_client import KaggleDatasetMeta, KaggleRef
from ibis.modules.datasets.profiling import ColumnProfile, FileProfile
from ibis.modules.llm.client import LLMResult, LLMUnavailable


def _profile() -> FileProfile:
    return FileProfile(
        row_count=768,
        column_count=3,
        missing_percentage=1.5,
        columns=[
            ColumnProfile(
                name="patient_age",
                dtype_original="int64",
                dtype_interpreted="numerical",
                is_nullable=False,
                is_pii=False,
                example_values=["31"],
                position=0,
                stats={},
            ),
            ColumnProfile(
                name="blood_pressure",
                dtype_original="int64",
                dtype_interpreted="numerical",
                is_nullable=True,
                is_pii=False,
                example_values=["72"],
                position=1,
                stats={},
            ),
            ColumnProfile(
                name="diagnosis",
                dtype_original="object",
                dtype_interpreted="categorical",
                is_nullable=False,
                is_pii=False,
                example_values=["positive"],
                position=2,
                stats={},
            ),
        ],
    )


def _meta(**overrides: object) -> KaggleDatasetMeta:
    base = {
        "title": "Pima Indians Diabetes",
        "subtitle": "Predict diabetes onset from diagnostic measures",
        "description": "Dataset from the National Institute of Diabetes.",
        "license_name": "CC0-1.0",
        "total_bytes": 23_000,
        "tags": ["health", "diabetes", "classification"],
    }
    base.update(overrides)
    return KaggleDatasetMeta(**base)  # type: ignore[arg-type]


REF = KaggleRef("uciml", "pima-indians-diabetes-database")


class TestDomainsFromTags:
    def test_should_map_kaggle_tags_onto_the_project_vocabulary(self) -> None:
        assert enrichment.domains_from_tags(["health", "medicine"]) == ["healthcare"]

    def test_should_keep_at_most_three_domains(self) -> None:
        tags = ["health", "finance", "education", "biology", "environment"]
        assert len(enrichment.domains_from_tags(tags)) <= 3

    def test_should_ignore_tags_with_no_equivalent(self) -> None:
        assert enrichment.domains_from_tags(["beginner", "tabular", "eda"]) == []


class TestBaseMetadata:
    """Le socle déterministe : il doit tenir SANS aucun appel LLM."""

    def test_should_build_usable_metadata_without_any_llm(self) -> None:
        result = enrichment.build_base_metadata(REF, _meta(), _profile(), access_requested="public")

        assert result.display_name == "Pima Indians Diabetes"
        assert result.storage_uri == REF.url
        assert "uciml/pima-indians-diabetes-database" in (result.sources or "")
        assert result.access == "public"
        assert result.domain == ["healthcare"]
        assert "classification" in result.task

    def test_should_never_assert_an_ethical_criterion(self) -> None:
        """L'invariant du produit : rien de vert sans validation humaine."""
        result = enrichment.build_base_metadata(REF, _meta(), _profile(), access_requested="public")

        for criterion in ETHICAL_CRITERIA:
            assert getattr(result, criterion) is None, f"{criterion} ne doit pas être pré-rempli"

    def test_should_force_private_when_license_forbids_redistribution(self) -> None:
        result = enrichment.build_base_metadata(
            REF, _meta(license_name="CC BY-NC-SA 4.0"), _profile(), access_requested="public"
        )
        assert result.access == "private"

    def test_should_keep_private_when_the_user_asked_for_private(self) -> None:
        result = enrichment.build_base_metadata(
            REF, _meta(), _profile(), access_requested="private"
        )
        assert result.access == "private"

    def test_should_complete_domains_with_column_names_when_tags_are_useless(self) -> None:
        """Tags Kaggle inexploitables -> on retombe sur le profilage des colonnes."""
        result = enrichment.build_base_metadata(
            REF, _meta(tags=["beginner", "eda"]), _profile(), access_requested="public"
        )
        assert result.domain == ["healthcare"]  # déduit de patient_age / blood_pressure

    def test_should_record_real_missing_values_rather_than_a_guess(self) -> None:
        result = enrichment.build_base_metadata(REF, _meta(), _profile(), access_requested="public")
        assert "1.5" in (result.missing_values_description or "")


class TestEthicsSuggestions:
    def test_should_return_only_known_criteria_as_booleans(self, monkeypatch) -> None:
        payload = (
            '{"values": {"transparency": true, "anonymization_applied": false,'
            ' "inventé": true, "informed_consent": "peut-être"},'
            ' "notes": {"transparency": "Licence CC0 et documentation publique."}}'
        )
        monkeypatch.setattr(
            enrichment.llm_client,
            "complete",
            lambda **_: LLMResult(text=payload, model_used="m", tokens_used=1),
        )

        suggestions = enrichment.suggest_ethics(_meta(), _profile())

        assert suggestions is not None
        assert suggestions["values"] == {"transparency": True, "anonymization_applied": False}
        assert "inventé" not in suggestions["values"]  # clé inconnue rejetée
        assert "informed_consent" not in suggestions["values"]  # non booléen rejeté
        assert suggestions["is_fallback"] is False

    def test_should_return_none_when_the_llm_is_unavailable(self, monkeypatch) -> None:
        def boom(**_: object) -> LLMResult:
            raise LLMUnavailable("pas de clé")

        monkeypatch.setattr(enrichment.llm_client, "complete", boom)

        assert enrichment.suggest_ethics(_meta(), _profile()) is None

    def test_should_return_none_when_the_llm_answers_garbage(self, monkeypatch) -> None:
        monkeypatch.setattr(
            enrichment.llm_client,
            "complete",
            lambda **_: LLMResult(text="je ne sais pas", model_used="m", tokens_used=1),
        )

        assert enrichment.suggest_ethics(_meta(), _profile()) is None


class TestEnrich:
    """Le point d'entrée complet, tel que la tâche Celery l'appelle."""

    def test_should_keep_criteria_null_even_when_the_llm_suggests_values(self, monkeypatch) -> None:
        monkeypatch.setattr(
            enrichment.llm_client,
            "complete",
            lambda **_: LLMResult(
                text='{"values": {"transparency": true, "data_quality_documented": true}}',
                model_used="m",
                tokens_used=1,
            ),
        )

        result = enrichment.enrich(REF, _meta(), _profile(), access_requested="public")

        # Les suggestions existent…
        assert result.ethics_suggestions is not None
        assert result.ethics_suggestions["values"]["transparency"] is True
        # …mais le dataset lui-même reste vierge.
        assert result.metadata.transparency is None
        assert result.metadata.data_quality_documented is None

    def test_should_flag_when_the_license_downgraded_the_visibility(self) -> None:
        result = enrichment.enrich(
            REF,
            _meta(license_name="Other (specified in description)"),
            _profile(),
            access_requested="public",
        )

        assert result.metadata.access == "private"
        assert result.license_forced_private is True

    def test_should_survive_a_total_llm_outage(self, monkeypatch) -> None:
        def boom(**_: object) -> LLMResult:
            raise LLMUnavailable("réseau")

        monkeypatch.setattr(enrichment.llm_client, "complete", boom)

        result = enrichment.enrich(REF, _meta(), _profile(), access_requested="public")

        assert result.metadata.display_name == "Pima Indians Diabetes"
        assert result.ethics_suggestions is None
        assert result.metadata.objective  # objectif de repli issu du sous-titre Kaggle


class TestObjective:
    def test_should_use_the_llm_objective_when_available(self, monkeypatch) -> None:
        calls: list[str] = []

        def fake(**kwargs: object) -> LLMResult:
            calls.append(str(kwargs.get("system", "")))
            if "éthique" in str(kwargs.get("system", "")).lower():
                return LLMResult(text="{}", model_used="m", tokens_used=1)
            return LLMResult(
                text="Prédire l'apparition du diabète à partir de mesures cliniques.",
                model_used="m",
                tokens_used=1,
            )

        monkeypatch.setattr(enrichment.llm_client, "complete", fake)

        result = enrichment.enrich(REF, _meta(), _profile(), access_requested="public")

        assert result.metadata.objective == (
            "Prédire l'apparition du diabète à partir de mesures cliniques."
        )

    @pytest.mark.parametrize(
        "overrides,expected_fragment",
        [
            # Cascade de repli : sous-titre, puis description, puis titre. Jamais d'invention.
            ({"subtitle": "Predict onset"}, "Predict onset"),
            ({"subtitle": ""}, "National Institute"),
            ({"subtitle": "", "description": ""}, "Pima Indians Diabetes"),
        ],
    )
    def test_should_fall_back_on_kaggle_text(
        self, monkeypatch, overrides: dict[str, str], expected_fragment: str
    ) -> None:
        def boom(**_: object) -> LLMResult:
            raise LLMUnavailable("pas de clé")

        monkeypatch.setattr(enrichment.llm_client, "complete", boom)

        result = enrichment.enrich(REF, _meta(**overrides), _profile(), access_requested="public")

        assert expected_fragment in (result.metadata.objective or "")
