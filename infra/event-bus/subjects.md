# Event Bus Subjects

## Machine Learning Anomalies

- **Stream**: `apgms_ml_events`
- **Subject Prefix**: `ml`
- **Subject**: `ml.anomaly.detected`
- **Schema Version**: `1.0.0`
- **Payload**:
  ```json
  {
    "amount": 2450.55,
    "velocity": 4.1,
    "accountAgeDays": 90,
    "chargebackRate": 0.12,
    "score": 0.84,
    "threshold": 0.72,
    "modelVersion": "1.0.0"
  }
  ```
- **Description**: Published by the ML inference service whenever a transaction is flagged as anomalous. Downstream consumers (fraud response, case management, alerting pipelines) should subscribe to `ml.anomaly.detected`.

## Local Development

Set `EVENT_BUS_MODE=in-memory` to avoid connecting to NATS. In this mode, events remain in-process and are logged by the inference service.
