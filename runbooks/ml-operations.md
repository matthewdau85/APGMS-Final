# ML Operations Runbook

## Overview
The CI/CD workflow `.github/workflows/model-governance.yml` enforces model
integrity, bias, drift, and security checks. Model metadata lives in
`artifacts/ml/model-manifest.json`. This runbook describes the lifecycle for
retraining, approvals, and rollback.

## Retraining cadence
- **Quarterly baseline retraining** on the first Monday of each quarter using
  the latest labelled compliance outcomes.
- **Ad-hoc retraining triggers** include Alertmanager noise escalations,
  regulator feedback, or drift alerts (`model_drift_detected` firing in Grafana).
- Store all training notebooks and feature snapshots in the evidence store with
  the same `modelVersion` value referenced in the manifest.

## Approval gates
1. Open a change request referencing the target `modelId` and proposed
   `version`. Attach:
   - Training summary and validation metrics.
   - Bias audit report exported from `pnpm ml:bias-audit`.
   - Security scan summary (`pnpm ml:security-scan`).
2. Platform ML lead and Responsible AI reviewer must both approve before merge.
3. CI blocks deploys if any of the governance jobs fail. Each job uploads
   artifacts for traceability (`model-integrity.json`, `bias-report.json`,
   `drift-scan.json`).

## Deployment & rollback
- Deployments promote artifacts in the feature store and update
  `artifacts/ml/model-manifest.json`. Keep the previous manifest revision to
  allow one-click rollback.
- To rollback, re-run the workflow with `MODEL_VERSION=<previous>` and reapply
  the manifest. Re-tag the serving endpoint in the feature toggle service.
- After rollback, run the governance workflow manually to capture evidence and
  note the rollback in the incident tracker.

## Alert response
- `model_integrity_failed` alerts indicate checksum drift between manifest and
  deployed artifact. Freeze deploys, run the integrity job locally, and compare
  digests.
- `model_bias_alert` fires when bias metrics exceed thresholds. Reassess feature
  distribution, engage Responsible AI, and prepare hotfix retraining if needed.
- `model_drift_detected` suggests performance degradation. Kick off ad-hoc
  retraining and expand monitoring to affected segments.
