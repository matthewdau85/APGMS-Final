# Data Governance Runbook

## Data Lineage
- Maintain end-to-end lineage for each ML dataset across ingestion, transformation, feature engineering, and model training.
- Capture upstream system identifiers, transformation notebooks/jobs, and downstream consumers in the metadata catalog.
- Require lineage updates within 24 hours of any schema change or pipeline deployment.

## Data Anonymisation
- Apply irreversible pseudonymisation (tokenisation or hashing with salt rotation) for all direct identifiers prior to persistence in analytical stores.
- Enforce differential privacy noise thresholds for aggregate outputs shared outside of the core data science team.
- Review anonymisation techniques quarterly with privacy engineering to confirm they meet regulatory expectations.

## Data Retention Schedules
- Classify datasets by sensitivity (public, internal, restricted, highly restricted) and map each class to a retention period approved by legal.
- Implement automated lifecycle policies that purge restricted datasets after the authorised retention window, with audit logs proving destruction.
- Require exception approvals for extended retention, documented in the governance ticketing system with legal sign-off.

## Explainability Artefacts
- Generate model cards for each production model detailing training data composition, feature importance summaries, and known limitations.
- Store SHAP/LIME interpretability reports and scenario-based validation results alongside the model version in the model registry.
- Update artefacts on every material model retraining, ensuring customer-facing explainability summaries reflect the latest deployment.

## Fairness Audit Cadence
- Conduct bias assessments on all ML datasets prior to initial production release, covering protected attributes where available.
- Re-run fairness audits at least quarterly or upon major dataset refreshes, documenting parity metrics, mitigations, and owner approvals.
- Escalate audit failures to the ethics review board within two business days, with remediation timelines agreed before release resumes.
