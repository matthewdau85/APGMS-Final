"""Utility helpers for reading and writing model artifacts."""
from __future__ import annotations

import json
import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Mapping

import joblib

ISO_8601 = "%Y-%m-%dT%H:%M:%SZ"


@dataclass(frozen=True)
class ArtifactPaths:
    """Container for locating artefacts associated with a model."""

    base_dir: Path

    def model_path(self) -> Path:
        return self.base_dir / "model.joblib"

    def metrics_path(self) -> Path:
        return self.base_dir / "metrics.json"


def ensure_directory(path: Path) -> None:
    """Create *path* if it does not exist."""
    path.mkdir(parents=True, exist_ok=True)


def to_utc_now() -> str:
    """Return the current timestamp in UTC (ISO 8601)."""
    return datetime.now(timezone.utc).strftime(ISO_8601)


def write_json(path: Path, payload: Mapping[str, Any]) -> None:
    """Write *payload* to *path* with deterministic formatting."""
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, sort_keys=True, indent=2)
        handle.write("\n")


def read_json(path: Path) -> Dict[str, Any]:
    """Load a JSON document from *path*."""
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def compute_sha256(path: Path) -> str:
    """Return the SHA-256 digest for *path*."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def dump_model_artifact(
    path: Path,
    payload: Mapping[str, Any],
) -> str:
    """Persist *payload* to *path* using joblib and return the SHA-256 hash."""
    ensure_directory(path.parent)
    joblib.dump(payload, path)
    sha = compute_sha256(path)
    payload = dict(payload)
    metadata = dict(payload.get("metadata", {}))
    metadata["sha256"] = sha
    payload["metadata"] = metadata
    joblib.dump(payload, path)
    final_sha = compute_sha256(path)
    if final_sha != sha:
        metadata["sha256"] = final_sha
        payload["metadata"] = metadata
        joblib.dump(payload, path)
        final_sha = compute_sha256(path)
    return final_sha


def make_metadata(
    *,
    version: str,
    features_version: str,
    threshold: float,
) -> Dict[str, Any]:
    """Return the base metadata payload shared across models."""
    return {
        "version": version,
        "features_version": features_version,
        "threshold": threshold,
        "created_utc": to_utc_now(),
    }
