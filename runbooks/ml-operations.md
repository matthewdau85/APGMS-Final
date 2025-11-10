# ML Operations Runbook

## Overview
This runbook tracks lifecycle controls for the ml-service ensemble that backs BAS readiness and fraud scoring. It is the
source of truth for retraining cadences, differential privacy attestations, and escalation owners when metrics drift.

## Contacts
- **Model Owner:** Risk & Compliance Engineering Guild (`risk-eng@apgms.local`)
- **Product Owner:** Compliance Platform Lead (`compliance-lead@apgms.local`)
- **Pager Rotation:** `#ml-governance` (OpsGenie schedule `ML-GOV-Primary`)

## Environments
- **Production:** `ml-service.prod.apgms.local` (Fastify, port 4006)
- **Staging:** `ml-service.stg.apgms.local`
- **Local:** `http://localhost:4006`

## Runbooks
### 1. Model catalog validation (per commit)
1. Workflow: `.github/workflows/ml-governance.yml` → `model-integrity` job.
2. Actions:
   - Executes `pnpm --filter @apgms/ml-service run validate` to ensure every model has drift baselines and explanations.
   - Blocks merges if the catalog fails schema or fairness guard rails.

### 2. Drift monitoring (every 6 hours)
1. Trigger: Scheduled cron `0 */6 * * *`.
2. Actions:
   - Captures drift snapshots via `drift:check` script (writes to workflow logs).
   - If deltas exceed tolerance, the workflow should page `#ml-governance` with context from Prometheus dashboards
     (`/metrics` endpoint exposes `ml_feature_drift_score`).

### 3. Fairness regression (per PR & schedule)
1. Command: `pnpm --filter @apgms/ml-service run fairness:test`.
2. Asserts that max delta across protected attributes is `< 0.2`; if breached the workflow fails and requires bias review.

### 4. Security scanning (per PR)
1. Job `security-hardening` runs dependency audit (`pnpm audit`) and Trivy filesystem scan on `services/ml-service`.
2. Findings rated HIGH/CRITICAL open tickets in Jira project `RISKSEC`.

### 5. Retraining cadence
- **Frequency:** Weekly, aligned to Friday 02:00 UTC.
- **Inputs:** Latest treasury inflow data, fraud case labels, regulator findings.
- **Procedure:**
  1. Pull latest datasets into secured S3 bucket (`s3://apgms-ml-training/bas_shortfall/YYYY-MM-DD/`).
  2. Execute offline notebooks and regenerate `services/ml-service/models/catalog.json`.
  3. Run local smoke (`pnpm --filter @apgms/ml-service run validate && run fairness:test`).
  4. Raise PR with updated catalog, link to retraining evidence in GRC ticket.
  5. Update this runbook with training summary (section "Retraining log").

### 6. DSP attestation review
- **Frequency:** Quarterly (first Monday 09:00 UTC).
- **Owners:** Compliance Platform + Security Assurance.
- **Checklist:**
  - Confirm model catalog references active DSP control IDs.
  - Verify immutable decision log hashes (table `RiskDecisionLog`) align with audit exports.
  - Capture approvals in DSP control tracking tool (`DSP-CTRL-021`).

## Operational dashboards
- **Prometheus:** `https://monitoring.apgms.local/d/ml-governance` (latency & drift).
- **Grafana:** Panel `ML Governance / Drift vs Baseline` monitors `ml_feature_drift_score` gauge.
- **BigQuery ML Warehouse:** dataset `ml_audit` for decision replay.

## Retraining log
| Date (UTC) | Owner | Models | Notes |
|------------|-------|--------|-------|
| _pending_  |       |        |       |

## DSP Attestation log
| Quarter | Owner | Outcome | Evidence |
|---------|-------|---------|----------|
| _pending_ |     |         |          |
