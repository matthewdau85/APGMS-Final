# Security Runbook – Admin Audit Logs

## Log storage
- Audit events are written to the append-only sink described in [infra/audit/README.md](../../infra/audit/README.md).
- Files are organized by the key prefix `audit/yyyy/mm/dd/*.jsonl`.

## Access and retention
- Enable immutable retention policies (WORM or retention lock) to prevent tampering.
- Rotate credentials quarterly and enforce read-only IAM roles for security, compliance, and incident-response teams.
- Retain audit data for a minimum of seven years unless local regulation requires a longer period.

## Investigations
- Search for entries with `type:"audit"` and filter by `corrId` to follow a single request through downstream systems.
- Combine `action` and `orgId` filters to narrow investigations to a specific tenant or activity.
- When redacted values (e.g., `***redacted***`) appear, coordinate with compliance to request an authorized reveal from the operational datastore if required.

## On-call checklist
1. Confirm append-only storage health (no failed lifecycle jobs, bucket retention intact).
2. Verify that ingestion pipelines are current (no backlog > 5 minutes).
3. Validate that redaction is functioning by sampling recent events for masked fields.
