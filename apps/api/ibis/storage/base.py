"""Interface de stockage — clés opaques type 'datasets/{id}/{uuid}.parquet' (ADR-005)."""

from abc import ABC, abstractmethod
from collections.abc import Iterator
from typing import BinaryIO


class Storage(ABC):
    @abstractmethod
    def save(self, key: str, stream: BinaryIO) -> int:
        """Écrit le flux sous `key`, renvoie la taille en octets."""

    @abstractmethod
    def open(self, key: str) -> BinaryIO:
        """Ouvre `key` en lecture binaire. FileNotFoundError si absent."""

    @abstractmethod
    def exists(self, key: str) -> bool: ...

    @abstractmethod
    def delete(self, key: str) -> None:
        """Supprime `key` (silencieux si absent)."""

    @abstractmethod
    def size(self, key: str) -> int: ...

    def stream(self, key: str, chunk_size: int = 1024 * 1024) -> Iterator[bytes]:
        with self.open(key) as fh:
            while chunk := fh.read(chunk_size):
                yield chunk
