# ML Operations Runbook

## Scope
This runbook governs all lifecycle operations for production machine-learning models used in fraud detection, remittance scoring, and device-risk analytics.

## Cadence & Scheduling
- **Retraining** occurs on the first Tuesday of each month. Feature store snapshots are frozen the preceding Friday at 18:00 AEST.
- **Hotfix retraining** may be invoked ad-hoc when drift or bias alerts breach thresholds documented below. Hotfixes require Risk & Compliance approval prior to deployment.
- **Evaluation window**: validation and backtesting must complete within a 24-hour change window before the maintenance freeze lifts.

## Approval Workflow
1. Model owner prepares the retraining bundle (data hashes, training manifest, evaluation metrics) and uploads artefacts to `artifacts/models/`.
2. Risk Officer reviews fairness/bias outputs and signs off in the change ticket.
3. Security Engineering validates integrity checksums and Trivy scan results.
4. Operations Lead approves production deployment after verifying guardrail workflow (`ml-guardrails` pipeline) completed successfully.
5. Deployment proceeds via the CI/CD workflow with dual approval recorded in the ticketing system.

## Guardrails & Quality Gates
- **Integrity**: checksum comparison between the registered model manifest and the build artefact. The CI job fails on mismatch.
- **Bias**: fairness metrics must meet configured bounds (equal opportunity gap < 2%). Deviations raise a blocking failure requiring Risk Officer approval to proceed.
- **Drift**: population-stability index (PSI) > 0.2 triggers hotfix retraining workflow.
- **Security**: container and dependency scans (Trivy, pip/npm audit) must pass with no critical findings.

## Rollback Procedure
1. Initiate `ml:rollback` change request referencing the last known-good model version (tracked in `config/ml/controls.json`).
2. Use the deployment pipeline to redeploy the rollback version. Integrity checks must pass before traffic is switched.
3. Post-rollback validation compares live metrics with the rollback baseline for 1 hour. Escalate to the on-call ML engineer if anomalies persist.
4. Document the rollback outcome and root cause analysis in the incident repository within 24 hours.

## Human-in-the-loop Oversight
- Manual review teams are paged when the manual review queue backlog exceeds 25 items or when `remittance_manual_reviews_total` spikes 2x baseline.
- All overrides and feedback submitted via `/ml/decisions` endpoints automatically log tamper-evident audit records.
- Security operations receives daily summaries of MFA policy enforcement, device-risk escalations, and remittance retry volumes for pattern analysis.
