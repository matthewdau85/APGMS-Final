"""Utilities for locating project-relative directories."""

from __future__ import annotations

from os import getenv
from pathlib import Path


def repo_root() -> Path:
    """Return the repository root based on this file's location."""
    return Path(__file__).resolve().parents[5]


def artifact_dir() -> Path:
    """Return the directory used for storing feature artifacts.

    The location can be overridden with the ``ML_CORE_ARTIFACT_DIR`` environment
    variable, but defaults to ``artifacts/notebooks`` inside the repository.
    """

    override = getenv("ML_CORE_ARTIFACT_DIR")
    if override:
        path = Path(override).expanduser().resolve()
    else:
        path = repo_root() / "artifacts" / "notebooks"

    path.mkdir(parents=True, exist_ok=True)
    return path


__all__ = ["repo_root", "artifact_dir"]
