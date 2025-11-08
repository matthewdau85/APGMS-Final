"""Train routine for the apportionment model."""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Tuple

import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

PACKAGE_ROOT = Path(__file__).resolve().parents[2]
if str(PACKAGE_ROOT) not in sys.path:
    sys.path.append(str(PACKAGE_ROOT))

from common.io import ArtifactPaths, dump_model_artifact, make_metadata, write_json  # noqa: E402
from common.metrics import (  # noqa: E402
    RANDOM_STATE,
    feature_summary,
    gate_metrics,
    regression_metrics,
    summarise_gate,
)
from common.thresholds import get_thresholds  # noqa: E402

MODEL_NAME = "apportion"
VERSION = "0.1.0"
FEATURES_VERSION = "0.1.0"
SAMPLES = 520
TEST_SIZE = 0.25


def _generate_dataset(samples: int) -> Tuple[pd.DataFrame, pd.Series]:
    rng = np.random.default_rng(RANDOM_STATE)
    df = pd.DataFrame(
        {
            "allocation_base": rng.normal(loc=10_000, scale=2_500, size=samples),
            "growth_factor": rng.uniform(low=0.8, high=1.2, size=samples),
            "regional_index": rng.integers(low=1, high=8, size=samples),
        }
    )
    noise = rng.normal(loc=0.0, scale=250.0, size=samples)
    target = (
        0.5 * df["allocation_base"].to_numpy()
        + 2_000 * df["growth_factor"].to_numpy()
        + 300 * df["regional_index"].to_numpy()
        + noise
    )
    return df, pd.Series(target, name="apportionment")


def main() -> None:
    thresholds = get_thresholds(MODEL_NAME)
    feature_frame, target = _generate_dataset(SAMPLES)
    x_train, x_test, y_train, y_test = train_test_split(
        feature_frame,
        target,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
    )

    pipeline = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            (
                "regressor",
                LGBMRegressor(random_state=RANDOM_STATE, n_estimators=50, learning_rate=0.1),
            ),
        ]
    )
    pipeline.fit(x_train, y_train)

    predictions = pipeline.predict(x_test)
    metrics_payload = regression_metrics(y_true=y_test, y_pred=predictions)
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
