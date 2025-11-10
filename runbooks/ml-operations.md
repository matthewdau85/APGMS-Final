# ML Operations Runbook

This runbook documents the lifecycle management, governance workflow, and rollback procedures for the `fraud-detection` model hosted by `services/ml-service`.

## Ownership and Contacts
- **Model Owner:** Risk & ML Engineering Guild
- **Business Sponsor:** Regulatory Affairs Director
- **PagerDuty Rotation:** `ml-ops-oncall`

## Lifecycle Management

### Retraining Cadence
- **Frequency:** Monthly retraining on the first Monday, or immediately when:
  - Drift score (`apgms_ml_feature_drift_score`) > 0.6 for any feature for two consecutive hours.
  - Error budget burn rate (`apgms_ml_error_budget_burn_rate`) > 1.0 for a rolling four-hour window.
  - Regulators submit >10 validated false positives/negatives in a week.
- **Data Cut:** Use the approved feature store snapshot declared in `model/manifest.json`.
- **Versioning:** Increment the semantic version in `model/manifest.json`; archive the previous manifest and bias report under `artifacts/`.

### Approval Workflow
1. Train candidate model using notebooks stored in the regulated ML workspace.
2. Generate bias and fairness reports. These must satisfy thresholds defined in `reports/latest-bias-report.json`.
3. Run `pnpm --filter @apgms/ml-service run governance:check` to verify provenance, checksum, and bias approvals.
4. Submit evidence pack (training logs, bias report, validation metrics) to Regulatory Affairs for sign-off.
5. Obtain approval from the ML Governance Board (record approver in `model/manifest.json`).
6. Merge PR only after CI governance job is green and sign-off is attached in Jira ticket `MLGOV-*`.

### Deployment & Rollback
- **Deployment:**
  - Tag Docker image with model version (e.g., `fraud-detection:2024-10-15`).
  - Promote through staging using Argo Rollouts with canary of 10% traffic.
  - Monitor inference latency and error budget gauges in Grafana dashboard `ML/Fraud Detection`.
- **Rollback Triggers:**
  - Error budget remaining ratio < 0.4 for 15 minutes.
  - Drift score average > 0.75 across monitored features.
  - Regulator-reported false negative escalations > 3 within an hour.
- **Rollback Process:**
  1. Freeze feedback ingestion via feature toggle `ML_FEEDBACK_ENABLED` if label noise suspected.
  2. Roll back deployment using `argo rollouts undo ml-service` to previous stable version.
  3. Re-point `model/manifest.json` to the last good version; update checksum artifacts.
  4. Notify Regulatory Affairs and Finance via #ml-ops channel and email distribution list.

## Observability
- **Prometheus Endpoint:** `https://ml-service.$ENV.svc.cluster.local/metrics`
- **Key Metrics:**
  - `apgms_ml_inference_duration_seconds{model,version,outcome}`
  - `apgms_ml_error_budget_remaining_ratio{model,version}`
  - `apgms_ml_feature_drift_score{model,version,feature}`
  - `apgms_ml_feedback_labels_total{source,label}`
- **Grafana Panels:** latency histogram, burn-rate sparkline, drift heatmap, feedback counts.

## Feedback Labelling Process
1. Regulators and Finance teams submit feedback via `/feedback` endpoint with SSO JWT.
2. Labels persisted in Prisma `ModelFeedback` table; nightly job exports to feature store for retraining.
3. Weekly review triage ensures false negatives are prioritized for remediation and manual investigation.

## Compliance Evidence
- Store audit artefacts (manifest, bias report, checksum) under version control.
- Governance CI workflow stores logs alongside build artifacts for five years per compliance policy.
- Quarterly internal audits verify that every deployment has an associated approved bias report and checksum record.
