"""Driver LocalFS : volume Docker `ibis-data` partagé api + worker (ADR-005).

Les clés sont validées contre la traversée de chemin ; les fichiers ne sont
JAMAIS servis directement — uniquement via endpoints authentifiés (ARCH §8).
"""

import shutil
from pathlib import Path
from typing import BinaryIO

from ibis.storage.base import Storage


class LocalFSStorage(Storage):
    def __init__(self, root: str) -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root):
            raise ValueError(f"Clé de stockage invalide : {key!r}")
        return path

    def save(self, key: str, stream: BinaryIO) -> int:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".part")
        with tmp.open("wb") as out:
            shutil.copyfileobj(stream, out)
        tmp.replace(path)
        return path.stat().st_size

    def open(self, key: str) -> BinaryIO:
        return self._path(key).open("rb")

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def delete(self, key: str) -> None:
        path = self._path(key)
        if path.is_file():
            path.unlink()

    def size(self, key: str) -> int:
        return self._path(key).stat().st_size
