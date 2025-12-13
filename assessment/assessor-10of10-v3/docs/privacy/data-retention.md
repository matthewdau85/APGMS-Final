# Data Retention

## Objective
Define how long APGMS retains different data classes and how deletion is enforced.

## Retention table (example)
- Audit events: 7 years (compliance)
- Payroll uploads: 2 years
- Raw exports: 90 days
- Logs: 30-90 days

## Enforcement
- A retention job runs on schedule and deletes/archives data according to the table.
- Deletions are auditable (tombstone events).

## Evidence
- Worker job implementation to be linked once created.
