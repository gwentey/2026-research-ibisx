"""Client Kaggle — résolution d'une URL collée, métadonnées et téléchargement.

Passe par `httpx` (déjà au socle) plutôt que par la CLI `kaggle` : pas de sous-processus,
et surtout la taille se lit sur `totalBytes` AVANT tout téléchargement.

Auth : le jeton unique (`KAGGLE_API_TOKEN`) est prioritaire ; le couple username/key
« legacy » reste accepté tant que Kaggle le propose.
"""

import io
import posixpath
import re
import zipfile
from dataclasses import dataclass, field
from urllib.parse import urlparse

import httpx

from ibis.core.config import get_settings
from ibis.core.errors import InvalidInputError
from ibis.core.logging import get_logger

logger = get_logger(__name__)

KAGGLE_BASE_URL = "https://www.kaggle.com"
KAGGLE_HOSTS = {"kaggle.com", "www.kaggle.com"}

#: Plafond par défaut, sur la taille DÉCOMPRESSÉE (le stockage et le worker sont bridés en prod).
MAX_DATASET_BYTES = 200 * 1024 * 1024

TABULAR_SUFFIXES = {".csv", ".tsv", ".xlsx", ".xls"}

#: Sections kaggle.com qui ne sont pas des datasets — refus explicite plutôt que parsing
#: hasardeux. La valeur est le mot que verra l'utilisateur : « code » ou « c » ne lui
#: évoquent rien, « un notebook » ou « une compétition » lui disent quoi corriger.
NON_DATASET_SECTIONS = {
    "competitions": "une compétition",
    "c": "une compétition",
    "code": "un notebook",
    "kernels": "un notebook",
    "models": "un modèle",
    "discussions": "une discussion",
    "learn": "un cours",
}

_SEGMENT = r"[A-Za-z0-9][A-Za-z0-9._-]*"
_BARE_REF_RE = re.compile(rf"^{_SEGMENT}/{_SEGMENT}$")

#: Marqueurs de licences qui autorisent la redistribution dans le catalogue public.
_OPEN_LICENSE_MARKERS = (
    "cc0",
    "cc by",
    "ccby",
    "creative commons attribution",
    "public domain",
    "odbl",
    "open database",
    "pddl",
    "cdla",
    "mit",
    "apache",
    "gpl",
    "bsd",
)

#: Marqueurs qui disqualifient une licence même si elle contient un marqueur ouvert.
_RESTRICTED_LICENSE_MARKERS = ("-nc", " nc ", "nc-", "noncommercial", "non-commercial", "no deriv")


@dataclass(frozen=True)
class KaggleRef:
    """Référence canonique d'un dataset Kaggle."""

    owner: str
    slug: str

    @property
    def ref(self) -> str:
        return f"{self.owner}/{self.slug}"

    @property
    def url(self) -> str:
        return f"{KAGGLE_BASE_URL}/datasets/{self.ref}"


@dataclass
class KaggleDatasetMeta:
    """Ce que Kaggle sait du dataset — matière première de l'enrichissement."""

    title: str
    subtitle: str = ""
    description: str = ""
    license_name: str | None = None
    total_bytes: int = 0
    tags: list[str] = field(default_factory=list)
    usability_rating: float | None = None

    @property
    def redistributable(self) -> bool:
        return license_allows_redistribution(self.license_name)


def license_allows_redistribution(license_name: str | None) -> bool:
    """Le catalogue public redistribue les fichiers : défaut CONSERVATEUR.

    Ce qui n'est pas clairement ouvert renvoie False — l'import bascule alors en privé
    au lieu d'exposer publiquement un jeu qu'on n'a pas le droit de rediffuser.
    """
    if not license_name:
        return False
    normalized = f" {license_name.strip().lower()} "
    if any(marker in normalized for marker in _RESTRICTED_LICENSE_MARKERS):
        return False
    return any(marker in normalized for marker in _OPEN_LICENSE_MARKERS)


def parse_kaggle_url(url: str) -> KaggleRef:
    """Accepte toutes les formes que l'utilisateur peut coller (et rejette le reste)."""
    candidate = (url or "").strip()
    if not candidate:
        raise InvalidInputError("Aucun lien fourni.", code="KAGGLE_URL_INVALID")

    # Référence nue « owner/slug » — la forme du YAML de seed.
    if "://" not in candidate and "/" in candidate and _BARE_REF_RE.match(candidate):
        owner, slug = candidate.split("/", 1)
        return KaggleRef(owner=owner, slug=slug)

    if "://" not in candidate:
        candidate = f"https://{candidate}"

    parsed = urlparse(candidate)
    if parsed.hostname not in KAGGLE_HOSTS:
        raise InvalidInputError(
            "Ce lien ne pointe pas vers kaggle.com. Colle l'URL de la page du dataset, "
            "par exemple https://www.kaggle.com/datasets/uciml/iris",
            code="KAGGLE_URL_INVALID",
        )

    segments = [segment for segment in parsed.path.split("/") if segment]
    if segments and segments[0] == "datasets":
        segments = segments[1:]
    elif segments and segments[0] in NON_DATASET_SECTIONS:
        kind = NON_DATASET_SECTIONS[segments[0]]
        raise InvalidInputError(
            f"Ce lien pointe vers {kind}, pas vers un jeu de données. Ouvre l'onglet "
            "« Data » de la page, ou cherche le dataset sur kaggle.com/datasets — "
            "son adresse contient /datasets/.",
            code="KAGGLE_URL_NOT_A_DATASET",
        )

    if len(segments) < 2:
        raise InvalidInputError(
            "Lien incomplet : il manque le nom du dataset "
            "(attendu https://www.kaggle.com/datasets/<auteur>/<dataset>).",
            code="KAGGLE_URL_INVALID",
        )

    owner, slug = segments[0], segments[1]
    if not re.fullmatch(_SEGMENT, owner) or not re.fullmatch(_SEGMENT, slug):
        raise InvalidInputError("Lien Kaggle illisible.", code="KAGGLE_URL_INVALID")

    return KaggleRef(owner=owner, slug=slug)


def _is_safe_member(name: str) -> bool:
    """Refuse les chemins absolus et les remontées d'arborescence (zip slip)."""
    if name.startswith("/") or name.startswith("\\") or ".." in name.replace("\\", "/").split("/"):
        return False
    return not posixpath.isabs(posixpath.normpath(name))


class KaggleClient:
    """Accès HTTP à l'API Kaggle. `transport` permet de simuler le réseau en test."""

    def __init__(
        self,
        *,
        username: str = "",
        key: str = "",
        api_token: str = "",
        transport: httpx.BaseTransport | None = None,
        timeout: float = 120.0,
    ) -> None:
        if api_token:
            auth = None
            headers = {"Authorization": f"Bearer {api_token}"}
        elif username and key:
            auth = httpx.BasicAuth(username, key)
            headers = {}
        else:
            raise InvalidInputError(
                "Identifiants Kaggle absents : renseigne KAGGLE_API_TOKEN "
                "(ou KAGGLE_USERNAME/KAGGLE_KEY) côté serveur.",
                code="KAGGLE_NO_CREDENTIALS",
            )

        self._client = httpx.Client(
            base_url=KAGGLE_BASE_URL,
            auth=auth,
            headers=headers,
            transport=transport,
            timeout=timeout,
            follow_redirects=True,
        )

    def __enter__(self) -> "KaggleClient":
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()

    def close(self) -> None:
        self._client.close()

    def _get(self, path: str, ref: KaggleRef) -> httpx.Response:
        try:
            response = self._client.get(path)
        except httpx.HTTPError as exc:  # réseau injoignable, DNS, timeout…
            raise InvalidInputError(
                f"Kaggle est injoignable pour le moment ({exc.__class__.__name__}).",
                code="KAGGLE_UNREACHABLE",
            ) from exc

        if response.status_code in (401, 403):
            raise InvalidInputError(
                "Identifiants Kaggle refusés : vérifie la clé côté serveur.",
                code="KAGGLE_UNAUTHORIZED",
            )
        if response.status_code == 404:
            raise InvalidInputError(
                f"Dataset introuvable sur Kaggle : {ref.ref}. "
                "Vérifie le lien, ou le dataset est peut-être privé.",
                code="KAGGLE_NOT_FOUND",
            )
        if response.status_code >= 400:
            raise InvalidInputError(
                f"Kaggle a répondu {response.status_code} pour {ref.ref}.",
                code="KAGGLE_ERROR",
            )
        return response

    def view(self, ref: KaggleRef) -> KaggleDatasetMeta:
        """Métadonnées publiques — appelé AVANT tout téléchargement."""
        payload = self._get(f"/api/v1/datasets/view/{ref.ref}", ref).json()
        return KaggleDatasetMeta(
            title=payload.get("title") or ref.slug,
            subtitle=payload.get("subtitle") or "",
            description=payload.get("description") or "",
            license_name=payload.get("licenseName"),
            total_bytes=int(payload.get("totalBytes") or 0),
            tags=[str(tag) for tag in (payload.get("keywords") or [])],
            usability_rating=payload.get("usabilityRating"),
        )

    def ensure_within_size_cap(
        self, meta: KaggleDatasetMeta, *, max_bytes: int = MAX_DATASET_BYTES
    ) -> None:
        if meta.total_bytes and meta.total_bytes > max_bytes:
            raise InvalidInputError(
                f"Dataset trop volumineux ({meta.total_bytes // (1024 * 1024)} Mo) — "
                f"la limite est de {max_bytes // (1024 * 1024)} Mo.",
                code="KAGGLE_TOO_LARGE",
            )

    def download(
        self, ref: KaggleRef, *, max_bytes: int = MAX_DATASET_BYTES
    ) -> list[tuple[str, bytes]]:
        """Télécharge l'archive et n'en extrait que les fichiers tabulaires."""
        response = self._get(f"/api/v1/datasets/download/{ref.ref}", ref)

        try:
            archive = zipfile.ZipFile(io.BytesIO(response.content))
        except zipfile.BadZipFile as exc:
            raise InvalidInputError(
                f"L'archive Kaggle de {ref.ref} est illisible.", code="KAGGLE_BAD_ARCHIVE"
            ) from exc

        with archive:
            members = [info for info in archive.infolist() if not info.is_dir()]

            unsafe = [info.filename for info in members if not _is_safe_member(info.filename)]
            if unsafe:
                raise InvalidInputError(
                    f"Archive Kaggle refusée : chemin de fichier suspect ({unsafe[0]}).",
                    code="KAGGLE_UNSAFE_ARCHIVE",
                )

            tabular = [
                info
                for info in members
                if posixpath.splitext(info.filename)[1].lower() in TABULAR_SUFFIXES
            ]
            if not tabular:
                raise InvalidInputError(
                    f"L'archive de {ref.ref} ne contient aucun fichier tabulaire "
                    f"({', '.join(sorted(TABULAR_SUFFIXES))}).",
                    code="KAGGLE_NO_TABULAR_FILE",
                )

            # Plafond sur la taille DÉCOMPRESSÉE — une archive minuscule peut cacher des Go.
            uncompressed = sum(info.file_size for info in tabular)
            if uncompressed > max_bytes:
                raise InvalidInputError(
                    f"Dataset trop volumineux une fois décompressé "
                    f"({uncompressed // (1024 * 1024)} Mo) — la limite est de "
                    f"{max_bytes // (1024 * 1024)} Mo.",
                    code="KAGGLE_TOO_LARGE",
                )

            return [(posixpath.basename(info.filename), archive.read(info)) for info in tabular]


def client_from_settings() -> KaggleClient:
    """Client configuré depuis l'environnement (jeton prioritaire, legacy en repli)."""
    settings = get_settings()
    return KaggleClient(
        username=settings.kaggle_username,
        key=settings.kaggle_key,
        api_token=getattr(settings, "kaggle_api_token", ""),
    )
