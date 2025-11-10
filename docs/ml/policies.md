# Machine Learning Governance and Release Policies

## Purpose
This policy describes how APGMS governs the lifecycle of machine learning
models, including retraining, approval, deployment, and ongoing monitoring. It
is maintained by the ML Working Group and reviewed quarterly.

## Roles and Responsibilities
- **Model Owners** – define objectives, validate data quality, and sign off on
  evaluation metrics prior to release.
- **Data Stewards** – manage data ingestion, catalogue provenance, and confirm
  privacy requirements are met before training commences.
- **ML Review Board** – cross-functional body (product, risk, legal, security)
  that approves promotion of any model to production.
- **MLOps Engineers** – operate retraining pipelines, ensure observability, and
  coordinate with platform engineering for deployment rollouts.

## Training and Retraining Workflow
1. Fresh data landing in `data/ml/training/` triggers the automated retraining
   workflow defined in `.github/workflows/ml_retrain.yml`.
2. The workflow orchestrates `scripts/ml-retrain.mjs`, which
   validates data freshness, executes the retraining command, and captures
   provenance in `artifacts/ml/last_retrain.json`.
3. Retraining jobs must produce model metadata under `artifacts/ml/` including
   the dataset summary, training hash, and key quality metrics.
4. All retraining runs automatically publish telemetry snapshots so dashboards
   can surface drift, accuracy, and operational health trends.

## Approval Gates
Before a retrained model can be promoted:
- Model Owners review performance metrics alongside historical telemetry to
  validate improvements.
- Data Stewards confirm that training datasets comply with privacy and
  retention policies (see below).
- The ML Review Board records their decision with rationale in the governance
  tracker; approvals require at least one representative from risk and legal.
- Deployment may proceed only after approvals are logged and all P0 regressions
  from monitoring dashboards are triaged.

## Release Management
- Approved model artifacts are versioned via the generated metadata file and
  stored in the model registry bucket. The GitHub workflow attaches a copy as a
  build artifact for audit purposes.
- Rollouts follow a progressive strategy: canary in staging, limited customer
  exposure, then full production rollout with rollback plans defined.
- Post-release reviews occur within seven days to evaluate telemetry trends and
  confirm no policy violations.

## Monitoring and Escalation
- `services/ml-inference` exports telemetry JSON snapshots consumed by Grafana
  dashboards that chart accuracy, drift, latency, and dataset freshness.
- Alerts fire when drift scores exceed thresholds or performance drops more
  than 3% relative to the prior approved model.
- Incident responders must page the ML Review Board and MLOps on-call when
  alerts breach production thresholds; mitigation actions include rollback,
  manual retraining, or feature flag adjustments.

## Privacy, Retention, and Compliance
- Customer-identifiable attributes are anonymised via irreversible hashing when
  deletions cannot be completed due to retention obligations.
- Hard deletion occurs only after the configured retention period has lapsed;
  retention windows are configurable through `DATA_RETENTION_DAYS` and audited
  quarterly.
- Periodic reviews ensure anonymisation logic continues to meet regulatory
  guidance (GDPR, CDR, GLBA) and that data minimisation practices remain
  effective.
- Any policy changes require approval from Legal, the Privacy Office, and the
  ML Review Board with documented sign-off stored alongside governance records.

## Review Cadence
This policy is reviewed quarterly by the ML Review Board and whenever
regulations change materially. Proposed edits are submitted via pull request
and require approvals from at least Legal and Privacy leads before merge.
