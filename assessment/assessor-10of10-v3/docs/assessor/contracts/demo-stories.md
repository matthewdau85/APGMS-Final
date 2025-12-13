# Demo Stories (Stakeholder Walkthroughs)

These stories are designed to validate APGMS' demo posture: controlled, scripted, and repeatable.

## Story 1: Admin - Onboard an organisation

- Actor: Admin (platform operator)
- Goal: Create org, configure tax types, and enable integrations.
- Success criteria:
  - Org created with a stable orgId.
  - Default funds/ledgers created (tax buffer, settlement, discretionary).
  - Audit events emitted for all privileged actions.
  - Regulator view renders without errors.

## Story 2: Business - Upload payroll/withholding data

- Actor: Business user (org-scoped)
- Goal: Upload sample payroll data and see PAYGW obligation forecast.
- Success criteria:
  - Upload accepted and validated.
  - Idempotency prevents duplicates.
  - Ledger movements are explainable and traceable.

## Story 3: Regulator - Review compliance summary

- Actor: Regulator (read-only)
- Goal: View compliance summary, flagged risks, and evidence.
- Success criteria:
  - Only org-scoped data is visible.
  - Risk summaries show deterministic inputs.
  - Evidence exports include stable hashes and timestamps.

## Story 4: Failure path - Attempt cross-tenant access

- Actor: Malicious user / test harness
- Goal: Attempt to access data from another orgId.
- Success criteria:
  - Request denied with clear error (no leakage in response).
  - Security log contains traceable entry.
