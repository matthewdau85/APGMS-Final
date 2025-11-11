# Data Governance Runbook

## Purpose
This runbook defines the operational practices for maintaining trustworthy data across the platform, ensuring compliance with regulatory commitments and internal policies.

## Lineage Tracking
- **Capture**: All ingestion, transformation, and export jobs must emit OpenLineage-compliant events with job IDs, input/output datasets, and transformation metadata.
- **Storage**: Lineage events are persisted in the central metadata repository (`infra/metadata-catalog`) with a 5-year retention policy and daily backups.
- **Monitoring**: The Data Governance team reviews lineage completeness dashboards each Monday. Missing lineage triggers PagerDuty alert `DG-Lineage-Gap` routed to the on-call data steward.
- **Change Management**: Pipeline owners must update lineage contracts before deploying schema or dependency changes, verified during change-review.

## Data Anonymisation
- **Techniques**: Apply irreversible hashing for identifiers, differential privacy noise for aggregate analytics, and tokenisation for reversible customer lookups.
- **Scope**: All non-production environments receive anonymised datasets; production exports containing personal data require Data Privacy Officer (DPO) approval.
- **Controls**: Use the `shared/anonymiser` library with configuration stored in HashiCorp Vault. Updates demand peer review plus security sign-off.
- **Validation**: Nightly batch jobs validate anonymisation effectiveness; failures page the Privacy Engineering on-call via `PE-Anon-Breach`.

## Data Retention Schedules
- **Authoritative Register**: `data/retention-register.yaml` enumerates dataset-level retention periods and purge workflows.
- **Automation**: The `services/data-retention` service enforces delete workflows using immutable audit logs.
- **Review Cadence**: Legal, Compliance, and Data Governance representatives jointly review the register quarterly. Updates are captured in Jira project `DG-RET`.
- **Exceptions**: Any retention extensions require General Counsel approval, documented in the exception register and set to auto-expire after 90 days.

## Explainability Artefacts
- **Models Covered**: All high-risk ML services listed in `docs/ml/high-risk-models.md`.
- **Artefact Types**: SHAP summary plots, feature importance narratives, and decision logic flowcharts produced by CI on each model release.
- **Storage & Access**: Artefacts live under `artifacts/explainability/<model>/<version>/` with role-based access controls enforced by Okta.
- **Review**: Model risk committee reviews artefacts monthly; unresolved questions generate Jira tickets tagged `Explainability`.

## Fairness Audit Cadence
- **Frequency**: Bias metrics evaluated every sprint (bi-weekly) using fairness pipelines in `services/fairness-auditor`.
- **Metrics**: Monitor demographic parity difference, equal opportunity, and calibration across protected classes as defined in `policies/fairness-scope.md`.
- **Escalation**: Metrics breaching thresholds raise `Fairness-Alert` incidents requiring response within 24 hours.
- **Reporting**: Quarterly fairness summaries are published to the Compliance portal and shared with the Ethics board.

## Contacts
- **Data Governance On-Call**: PagerDuty schedule `Data-Governance`.
- **Privacy Engineering On-Call**: PagerDuty schedule `Privacy-Eng`.
- **DPO**: dpo@yourdomain.example
