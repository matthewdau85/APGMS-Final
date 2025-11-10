# Machine Learning Operations Runbook

This runbook codifies operational controls for the `services/ml-service` deployment so regulators can validate that inference quality, human-in-the-loop oversight, and rollback mechanisms meet compliance expectations.

## Retraining cadence

- **Schedule** – The model retrains on the second Tuesday of every month at 02:00 UTC using the production training pipeline (`worker/train-model.ts`).
- **Eligibility gate** – Training jobs run only when:
  - The latest bias evaluation report (`artifacts/model/bias-report.json`) reports `status: "pass"`.
  - Error-budget gauges from `ml_inference_error_budget_remaining` stay above 15% for the trailing 7 days.
  - At least 25 new human feedback labels have been ingested since the previous retraining window.
- **Source of truth** – Training data snapshots, feature store hashes, and pipeline commit SHAs are recorded in `artifacts/model/reproducibility-report.json` and stored in the compliance evidence repository.
- **Notification** – PagerDuty schedule `ML On-Call` receives a reminder 24 hours before the window. Finance and regulator distribution lists are copied on the calendar invite.

## Approval workflow

1. **Experiment tracking** – Candidate models must publish inference latency, drift, and feedback metrics to Prometheus via the `/metrics` endpoint exposed by `services/ml-service`.
2. **Change record** – Submit a change request in the deployment tracker referencing the training pipeline commit and attaching:
   - the updated model manifest (`artifacts/model/manifest.json`),
   - SHA256 integrity proof for each artifact (`tools/ml/verify-artifacts.mjs` output), and
   - the reproducibility summary (`artifacts/model/reproducibility-report.json`).
3. **Dual sign-off** – Finance and Regulatory approvers review the change request, ensure Grafana dashboards `ML Service Inference Overview` and `Model Drift Deep Dive` show healthy signals, then approve in writing.
4. **Deployment hold** – CI enforces bias and reproducibility checks via `.github/workflows/ml-governance.yml`. Deployment can progress only when the workflow succeeds on the release branch.

## Rollback procedure

- **Trigger conditions** – Roll back immediately if error budgets drop below 5% for 15 consecutive minutes, or if finance/regulator stakeholders file three or more critical feedback labels within an hour.
- **Execution steps**
  1. Halt new deployments by toggling the `ml-governance` environment protection in GitHub.
  2. Revert to the previously approved model artifact by redeploying the prior manifest entry (`manifest.history[n-1]`) with its associated SHA from `artifacts/model/manifest.json`.
  3. Flush the canary inference queue and warm caches using `pnpm --filter @apgms/ml-service run start` against the last stable tag.
  4. Update Grafana annotations noting the incident start/end times and affected model version.
- **Post-incident** – Capture a timeline in the compliance evidence repository, attach the feedback records retrieved from `GET /feedback/:predictionId`, and raise a follow-up action item to expand the training dataset if drift contributed to the rollback.

