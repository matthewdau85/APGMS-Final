"""Shared helpers for MLflow tracking."""

from __future__ import annotations

import json
import os
import platform
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Iterable

import mlflow

from ..config import DEFAULT_TRACKING_URI


def configure_tracking(tracking_uri: str | None = None) -> None:
    mlflow.set_tracking_uri(tracking_uri or DEFAULT_TRACKING_URI)


@contextmanager
def start_run(experiment_name: str, run_name: str | None = None, tags: dict[str, Any] | None = None):
    if experiment_name:
        mlflow.set_experiment(experiment_name)
    with mlflow.start_run(run_name=run_name) as active_run:
        if tags:
            mlflow.set_tags({k: str(v) for k, v in tags.items()})
        yield active_run


def log_reproducibility_metadata(random_state: int | None = None, extras: dict[str, Any] | None = None) -> None:
    metadata = {
        "timestamp": datetime.utcnow().isoformat(),
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "working_directory": os.getcwd(),
    }
    if random_state is not None:
        metadata["random_state"] = random_state
    if extras:
        metadata.update(extras)
    mlflow.log_dict(metadata, "reproducibility.json")


def log_dataframe_preview(name: str, frame) -> None:
    preview_path = f"artifacts/{name}_preview.json"
    payload = frame.head(5).to_dict(orient="records")
    mlflow.log_text(json.dumps(payload, indent=2), preview_path)


def log_feature_list(columns: Iterable[str]) -> None:
    mlflow.log_text("\n".join(columns), "artifacts/features.txt")


__all__ = [
    "configure_tracking",
    "start_run",
    "log_reproducibility_metadata",
    "log_dataframe_preview",
    "log_feature_list",
]
