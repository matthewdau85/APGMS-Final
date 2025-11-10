# Inference Service

The inference service wraps the risk scoring model shipped with `@apgms/inference`. It exposes a synchronous Fastify REST API
and an asynchronous NATS worker so consuming services can choose the transport that best fits their workflow.

## REST contract

* **Route:** `POST /inference/score`
* **Request body:**

```json
{
  "requestId": "uuid-or-business-key",
  "orgId": "org identifier",
  "features": {
    "payrollVariance": 0.0,
    "reconciliationLagDays": 0.0,
    "transactionVolume": 0.0,
    "alertDensity": 0.0
  },
  "context": {"optional": "metadata"}
}
```

* **Response body:**

```json
{
  "result": {
    "requestId": "same as request",
    "modelVersion": "2025.02.0",
    "score": 0.42,
    "riskBand": "low",
    "contributingFeatures": [
      { "feature": "alertDensity", "contribution": 0.0123 }
    ]
  }
}
```

The service returns `400 invalid_request` if the payload is malformed and `500 inference_failed` when scoring raises an internal
error. Scores are expressed as probabilities; clients can apply additional business thresholds as needed. The default alert
threshold can be overridden using `INFERENCE_ALERT_THRESHOLD`.

## NATS subjects

The service subscribes to JetStream using the shared subject prefix. Helpers in `@apgms/shared/inference` compute the canonical
names:

| Subject | Payload | Description |
| --- | --- | --- |
| `${prefix}.inference.requested` | `InferenceRequestedEvent` | Submit a scoring job. |
| `${prefix}.inference.completed` | `InferenceCompletedEvent` | Published after each request with the computed score. |

Events are wrapped in the standard `BusEnvelope`. The `requestId` and `traceId` fields are preserved in the completion event so
consumers can correlate responses with upstream work. The worker acknowledges JetStream messages only after the result has been
published to the completion subject.

## Metrics & logging

Prometheus metrics are exposed at `/metrics` and follow existing naming conventions:

* `apgms_inference_requests_total{transport,modelVersion,outcome}` – request counter split by REST vs NATS.
* `apgms_inference_duration_seconds{transport,modelVersion,outcome}` – histogram capturing end-to-end latency.
* `apgms_inference_errors_total{transport,modelVersion,reason}` – classified errors for alerting.

Structured logs are emitted for both HTTP and NATS flows using the shared safe logging helpers so that sensitive values stay
redacted. Ready checks verify the model can score a neutral payload and, when configured, that the NATS connection is healthy.
