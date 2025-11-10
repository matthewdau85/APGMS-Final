"""Lightweight JSON logging for model experiments."""

from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping


DEFAULT_LOG_DIR = Path("artifacts/experiment_logs")


@dataclass(slots=True)
class ExperimentRecord:
    name: str
    created_at: str
    params: Mapping[str, Any]
    metrics: Mapping[str, float]

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True)


def log_experiment(
    name: str,
    *,
    params: Mapping[str, Any] | None = None,
    metrics: Mapping[str, float] | None = None,
    directory: Path | None = None,
) -> Path:
    """Persist experiment metadata to a JSON artifact."""

    directory = directory or DEFAULT_LOG_DIR
    directory.mkdir(parents=True, exist_ok=True)

    record = ExperimentRecord(
        name=name,
        created_at=datetime.now(timezone.utc).isoformat(),
        params=params or {},
        metrics=metrics or {},
    )

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = directory / f"{timestamp}_{name.replace(' ', '_').lower()}.json"
    path.write_text(record.to_json())
    return path


__all__ = ["log_experiment", "ExperimentRecord", "DEFAULT_LOG_DIR"]
