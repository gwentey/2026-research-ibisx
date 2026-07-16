"""Tests unitaires du driver LocalFSStorage (ADR-005)."""

import io
from pathlib import Path

import pytest

from ibis.storage.local import LocalFSStorage


@pytest.fixture()
def storage(tmp_path: Path) -> LocalFSStorage:
    return LocalFSStorage(str(tmp_path))


def test_save_open_roundtrip(storage: LocalFSStorage) -> None:
    size = storage.save("datasets/abc/file.parquet", io.BytesIO(b"hello parquet"))
    assert size == 13
    with storage.open("datasets/abc/file.parquet") as fh:
        assert fh.read() == b"hello parquet"


def test_exists_and_delete(storage: LocalFSStorage) -> None:
    assert not storage.exists("models/x.joblib")
    storage.save("models/x.joblib", io.BytesIO(b"m"))
    assert storage.exists("models/x.joblib")
    assert storage.size("models/x.joblib") == 1
    storage.delete("models/x.joblib")
    assert not storage.exists("models/x.joblib")
    storage.delete("models/x.joblib")  # idempotent


def test_stream_chunks(storage: LocalFSStorage) -> None:
    storage.save("k", io.BytesIO(b"a" * 2_000_000))
    chunks = list(storage.stream("k", chunk_size=1_000_000))
    assert len(chunks) == 2
    assert sum(len(c) for c in chunks) == 2_000_000


def test_path_traversal_rejected(storage: LocalFSStorage) -> None:
    with pytest.raises(ValueError, match="invalide"):
        storage.save("../evil.txt", io.BytesIO(b"x"))
    with pytest.raises(ValueError, match="invalide"):
        storage.open("a/../../etc/passwd")


def test_no_partial_file_visible_after_save(storage: LocalFSStorage) -> None:
    storage.save("d/f.bin", io.BytesIO(b"data"))
    parent = Path(storage.root) / "d"
    assert [p.name for p in parent.iterdir()] == ["f.bin"]
