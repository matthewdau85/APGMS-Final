# ML Operations Runbook

This runbook describes the end-to-end lifecycle management of the machine learning models that power APGMS decisioning services. It supplements existing platform runbooks by giving on-call operators, data scientists, and approvers a single source of truth for how we retrain, validate, ship, and roll back models.

## Ownership

| Role | Responsibility |
| ---- | -------------- |
| ML On-Call (rotating) | Coordinates incidents involving services/ml-service, owns rollback and emergency patches. |
| Data Science Lead | Approves model promotion, signs off on bias and regression reports. |
| Platform SRE | Maintains observability stack (Prometheus/Grafana) and CI policy enforcement. |

## Lifecycle Overview

1. **Data collection** – inference telemetry, operator feedback (`/ml/feedback`) and drift metrics land in the feature store each day.
2. **Candidate training** – data scientists run the automated training workflow (prefect pipeline `ml/training/flow.py`) on Tuesdays and Thursdays using the prior week's labelled data.
3. **Validation & sign-off** – each candidate must satisfy automated gates (see [Pre-deployment checks](#pre-deployment-checks)) and receive explicit approvals in Jira (`MLAPPROVAL-*` stream).
4. **Deployment** – approved artifacts are published to the model registry (`artifacts/models/<model>/<version>`), tagged, and deployed through the `ml-service` Helm chart.
5. **Post-deployment monitoring** – Grafana dashboards (`infra/observability/grafana/dashboards.json`) surface latency/error/drift. On-call watches for alerts defined in `infra/observability/prometheus/rules/ml-service.rules.yml` during the first 24 hours.
6. **Feedback incorporation** – labelled false positives/negatives are exported nightly and joined with feature logs for the next retraining batch.

## Retraining Cadence

- **Scheduled retraining** runs every **Wednesday at 02:00 AEST** via GitHub Actions `nightly.yml`. Output is a candidate artifact suffixed with the retraining date (`risk-score_YYYYMMDD`).
- **Ad-hoc retraining** can be triggered when:
  - Drift alert `MLInferenceDriftDetected` fires for more than 2 hours.
  - Error budget burn exceeds 10% (alert `MLInferenceErrorBudgetBurn`).
  - Regulators submit corrective action requests.
- Always record the trigger and dataset snapshot hash in the `MLAPPROVAL` ticket.

## Approval Workflow

1. **Automated evaluation** – CI job `model-artifact-checks.yml` must pass, validating signatures, bias report thresholds, and reproducibility (see [Pre-deployment checks](#pre-deployment-checks)).
2. **Peer review** – at least one data scientist different from the author must review the evaluation notebook and bias report stored beside the artifact (`artifacts/models/.../report.md`).
3. **Risk sign-off** – Compliance lead confirms that new model does not change regulated thresholds. Approval comment must reference audit log ID.
4. **Change ticket closure** – Once approvals exist, close the `MLAPPROVAL` ticket and link the promoting PR/commit hash.

## Rollback Strategy

- **Fast rollback (preferred)** – Use `kubectl rollout undo deployment/ml-service --to-revision=<last-good>` after verifying the previous model artifact still exists in the registry. Update PagerDuty incident with the revision.
- **Artifact pin** – Set `ML_MODEL_VERSION` env var in the deployment manifest to the last known good version and redeploy through ArgoCD. This is required if the issue is data-dependent rather than code-specific.
- **Feature flag kill-switch** – The API gateway exposes `/ml/feedback` for rapid labelling; if false positives spike we can temporarily disable downstream actions by setting `ML_DECISION_MODE=observe` via the feature flag service.
- **Post-rollback validation** – Confirm alerts have cleared in Grafana, run synthetic inference checks against canary dataset, and backfill missed operator feedback records once the service stabilises.

## Pre-deployment Checks

Every model promotion must pass automated gates:

- **Artifact integrity** – SHA256 signature matches registry manifest; verified in CI via `tools/ci/verify-model-artifacts.mjs`.
- **Bias & fairness** – Bias report `bias_report.json` must stay within policy thresholds. CI fails if any subgroup delta > 2%.
- **Reproducibility** – Training metadata (`training_run.json`) and container digest must match the output of `make reproduce-model VERSION=<tag>`.
- **Smoke tests** – Run `ml-service` container against the canary dataset; ensure latency < 750ms p95 and accuracy regression < 0.5% vs baseline.

## Incident Response

1. Acknowledge the alert in PagerDuty (`ML Inference SLO`).
2. Triage with Grafana dashboard to determine whether latency, errors, or drift is the leading symptom.
3. Check `/ml/feedback` volume for anomalous spikes; export recent labels if retraining is needed.
4. Decide between hotfix, rollback, or feature flagging (see [Rollback Strategy](#rollback-strategy)).
5. File a post-incident review capturing metrics, root cause, and remediation items.

## Data Retention

- Feedback entries in `ModelFeedback` are retained for **18 months** to support longitudinal analysis.
- When removing feedback for privacy reasons, run the `shared/scripts/redact-model-feedback.ts` job to pseudonymise payloads instead of deleting rows outright.

Keep this document updated whenever workflows or tooling change.
