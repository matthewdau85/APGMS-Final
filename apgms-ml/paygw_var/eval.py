"""Evaluation gate for the PAYGW variance model."""
from __future__ import annotations

import sys
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[2]
if str(PACKAGE_ROOT) not in sys.path:
    sys.path.append(str(PACKAGE_ROOT))

from common.io import ArtifactPaths, read_json  # noqa: E402
from common.metrics import gate_metrics, summarise_gate  # noqa: E402
from common.thresholds import get_thresholds  # noqa: E402

MODEL_NAME = "paygw_var"
VERSION = "0.1.0"


def main() -> None:
    thresholds = get_thresholds(MODEL_NAME)
    metrics_dir = PACKAGE_ROOT / "model" / "production" / MODEL_NAME / VERSION
    paths = ArtifactPaths(metrics_dir)
    metrics_path = paths.metrics_path()
    if not metrics_path.exists():
        raise SystemExit(f"Metrics file not found: {metrics_path}")

    payload = read_json(metrics_path)
    gates = gate_metrics(metrics_payload=payload.get("metrics", {}), thresholds=thresholds.metric_floor)
    passed = summarise_gate(gates)

    if not passed:
        missing = {name: status for name, status in gates.items() if not status}
        for metric_name, status in sorted(missing.items()):
            print(f"Gate failed for {metric_name}: {status}")
        raise SystemExit(1)

    print(f"All gates passed for {MODEL_NAME} version {VERSION}.")


if __name__ == "__main__":  # pragma: no cover - script entrypoint
    main()
