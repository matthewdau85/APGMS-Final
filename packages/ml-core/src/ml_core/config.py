"""Configuration helpers for ML core components."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


def _detect_repo_root() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "pnpm-workspace.yaml").exists():
            return parent
    return current.parent


REPO_ROOT: Path = _detect_repo_root()
DEFAULT_ARTIFACTS_ROOT: Path = Path(
    os.getenv("ML_CORE_ARTIFACTS_ROOT", REPO_ROOT / "artifacts" / "notebooks")
)
DEFAULT_DATASET_DOC_PATH: Path = Path(
    os.getenv("ML_CORE_DATASET_DOC", REPO_ROOT / "docs" / "ml" / "datasets.md")
)
DEFAULT_MODEL_STANDARDS_PATH: Path = Path(
    os.getenv("ML_CORE_MODEL_STANDARDS", REPO_ROOT / "docs" / "ml" / "model-standards.md")
)
DEFAULT_TRACKING_URI: str = os.getenv(
    "MLFLOW_TRACKING_URI", f"file:{(REPO_ROOT / 'artifacts' / 'mlruns').as_posix()}"
)


@dataclass(slots=True)
class DataSourceConfig:
    """Connection information for Prisma-backed data sources."""

    database_url: Optional[str] = None
    api_base_url: Optional[str] = None
    api_token: Optional[str] = None

    def as_sqlalchemy_kwargs(self) -> dict[str, str]:
        if not self.database_url:
            return {}
        return {"url": self.database_url}


__all__ = [
    "REPO_ROOT",
    "DEFAULT_ARTIFACTS_ROOT",
    "DEFAULT_DATASET_DOC_PATH",
    "DEFAULT_MODEL_STANDARDS_PATH",
    "DEFAULT_TRACKING_URI",
    "DataSourceConfig",
]
