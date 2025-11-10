# ML Inference Service Telemetry

This directory contains lightweight orchestration and telemetry helpers for the
inference service. The retraining pipeline synthesises model metadata and feeds
aggregated drift/performance metrics into JSON snapshots that dashboards can
consume.

- `pipeline/retrain.mjs` synthesises retraining output and produces metadata
  under `artifacts/ml/`.
- `telemetry/collector.mjs` persists drift/performance telemetry snapshots for
  dashboard ingestion.
