# ML Inference Service Runbook

## Overview

The ML Inference service (`@apgms/ml-inference`) exposes a REST API that scores transactions using a logistic anomaly detector. Anomalies publish alerts to the internal event bus (`ml.anomaly.detected`). The service also exports Prometheus metrics and structured logs for observability.

## Endpoints

- `GET /healthz` – Liveness/readiness probe.
- `GET /metrics` – Prometheus metrics (`apgms_ml_inference_*`).
- `POST /v1/anomaly-score` – Request body must include `orgId`, `key`, optional `traceId`, and a `payload` with the four model features (`amount`, `velocity`, `accountAgeDays`, `chargebackRate`). Returns `score`, `anomaly`, and the `modelVersion` used.

## Deployment

- Container image: `ghcr.io/apgms/ml-inference:latest`
- Kubernetes manifests: `infra/deployments/ml-inference/k8s-deployment.yaml`
- Local compose: `infra/deployments/ml-inference/docker-compose.yml`

### Configuration

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | HTTP listener port | `3005` |
| `EVENT_BUS_MODE` | `in-memory` or `nats` | `in-memory` |
| `NATS_URL` | JetStream endpoint (required when `EVENT_BUS_MODE=nats`) | – |
| `NATS_STREAM` | Stream name for anomaly events | `apgms_ml_events` |
| `NATS_SUBJECT_PREFIX` | Prefix applied to subjects | `ml` |
| `ANOMALY_SUBJECT` | Subject used for published anomalies | `ml.anomaly.detected` |
| `MODEL_PATH` | Absolute path to the logistic model JSON | Bundled `/srv/app/model/anomaly_model.json` |

## Operations

1. **Healthy** if `/healthz` returns `{"status":"ok"}` and `apgms_ml_inference_total{outcome="error"}` is not increasing.
2. **Anomaly surge** – Investigate upstream transaction volume. Alerts fire when `apgms_ml_inference_total{outcome="anomaly"}` spikes. Confirm events on NATS stream `apgms_ml_events` using `nats stream view`.
3. **NATS connectivity failures** – API errors return HTTP 400 with message `NATS configuration missing...` or logs show `Failed to publish anomaly`. Fallback to `EVENT_BUS_MODE=in-memory` while restoring JetStream.
4. **Model reload** – Deploy a new container image with updated `model/anomaly_model.json`. No hot-reload supported.

## Metrics

- `apgms_ml_inference_total{outcome="*"}` – counts normal/anomaly/error requests.
- `apgms_ml_inference_duration_seconds` – inference latency histogram.
- `apgms_ml_active_anomalies` – last anomaly flag (1=anomaly,0=normal).

Create dashboard panels for the three metrics and alert when:
- Errors exceed 5/min for 5 minutes.
- Duration p95 above 1s.
- Anomaly ratio above 10% for 10 minutes.

## Logging

Structured logs via `pino`. Set `LOG_LEVEL=debug` for verbose tracing. Error logs include `err` objects and `orgId`/`key` context when available.

## On-call Checklist

1. Confirm alert conditions via Prometheus.
2. Inspect recent logs (`kubectl logs deploy/ml-inference`).
3. Replay sample payloads via `curl -XPOST ...` (see example below).
4. If model corrupt, redeploy previous known-good image.
5. Escalate to Data Science if anomalies persist or scores appear biased.

### Example Payload

```bash
curl -s -X POST \
  http://ml-inference.platform.svc.cluster.local/v1/anomaly-score \
  -H 'Content-Type: application/json' \
  -d '{
    "orgId": "org-123",
    "key": "txn-9981",
    "payload": {
      "amount": 5100,
      "velocity": 6.1,
      "accountAgeDays": 45,
      "chargebackRate": 0.18
    }
  }'
```
