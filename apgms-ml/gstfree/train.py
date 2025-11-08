"""Train routine for the GST-free gate model."""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Tuple

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

PACKAGE_ROOT = Path(__file__).resolve().parents[2]
if str(PACKAGE_ROOT) not in sys.path:
    sys.path.append(str(PACKAGE_ROOT))

from common.io import ArtifactPaths, dump_model_artifact, make_metadata, write_json  # noqa: E402
from common.metrics import (  # noqa: E402
    RANDOM_STATE,
    classification_metrics,
    feature_summary,
    gate_metrics,
    summarise_gate,
)
from common.thresholds import get_thresholds  # noqa: E402

MODEL_NAME = "gstfree"
VERSION = "0.1.0"
FEATURES_VERSION = "0.1.0"
SAMPLES = 600
TEST_SIZE = 0.25


def _generate_dataset(samples: int) -> Tuple[pd.DataFrame, pd.Series]:
    rng = np.random.default_rng(RANDOM_STATE)
    df = pd.DataFrame(
        {
            "turnover": rng.normal(loc=100_000, scale=25_000, size=samples),
            "lodgments": rng.poisson(lam=5, size=samples),
            "industry_code": rng.integers(low=1, high=6, size=samples),
        }
    )
    logits = (
        0.00001 * df["turnover"].to_numpy()
        + 0.1 * df["lodgments"].to_numpy()
        - 0.05 * df["industry_code"].to_numpy()
    )
    probability = 1 / (1 + np.exp(-logits))
    target = (probability > 0.5).astype(int)
    return df, pd.Series(target, name="label")


def main() -> None:
    thresholds = get_thresholds(MODEL_NAME)
    feature_frame, labels = _generate_dataset(SAMPLES)
    x_train, x_test, y_train, y_test = train_test_split(
        feature_frame,
        labels,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=labels,
    )

    pipeline = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            (
                "clf",
                LogisticRegression(random_state=RANDOM_STATE, max_iter=500, solver="lbfgs"),
            ),
        ]
    )
    pipeline.fit(x_train, y_train)

    proba = pipeline.predict_proba(x_test)[:, 1]
    predictions = (proba >= thresholds.default_threshold).astype(int)
    metrics_payload = classification_metrics(y_true=y_test, y_pred=predictions, y_score=proba)
    gate_status = gate_metrics(metrics_payload=metrics_payload, thresholds=thresholds.metric_floor)

    output_dir = PACKAGE_ROOT / "model" / "production" / MODEL_NAME / VERSION
    paths = ArtifactPaths(output_dir)

    metadata = make_metadata(
        version=VERSION,
        features_version=FEATURES_VERSION,
        threshold=thresholds.default_threshold,
    )
    payload = {
        "model": pipeline,
        "metadata": metadata,
        "feature_names": list(feature_frame.columns),
        "feature_index": feature_summary(feature_frame.columns),
    }
    sha = dump_model_artifact(paths.model_path(), payload)

    write_json(
        paths.metrics_path(),
        {
            "model": MODEL_NAME,
            "version": VERSION,
            "metrics": metrics_payload,
            "thresholds": dict(thresholds.metric_floor),
            "gates": gate_status,
            "passed": summarise_gate(gate_status),
            "artifact_sha256": sha,
        },
    )


if __name__ == "__main__":  # pragma: no cover - script entrypoint
    main()
