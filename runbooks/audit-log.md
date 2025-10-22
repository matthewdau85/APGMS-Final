# Audit log access and rotation

## Overview

The API gateway and supporting services write structured audit events to the shared `artifacts/audit.log` file (override with the `AUDIT_LOG_PATH` environment variable). Each line is a JSON object with the fields:

- `timestamp`: ISO-8601 string in UTC
- `principal`: identifier of the actor who initiated the action
- `action`: fully qualified action string (for example, `admin.data.export`)
- `scope`: resource scope where the action occurred (for example, `org:abc:user:def`)
- `metadata`: optional, action-specific context

## Access procedure

1. Log in to the API gateway host (or the environment where the service is running) using the standard bastion workflow.
2. Navigate to the directory that contains the audit log. By default this is the repository root under `artifacts/`.
3. Use `tail -f artifacts/audit.log` for real-time monitoring, or `jq`/`grep` for ad-hoc queries. Because each line is valid JSON, tools such as `jq` can parse the entries directly.
4. Access to the audit log must be recorded in the support ticket for the investigation. Include the timeframe reviewed and the reason for access.

## Rotation and retention

- Rotate the log weekly or when the file exceeds 50 MB, whichever comes first.
- To rotate, copy the active log to a timestamped archive (for example, `cp artifacts/audit.log artifacts/audit-2024-01-05.log`) and then truncate the active file with `: > artifacts/audit.log`.
- Upload archived logs to the secure storage bucket labelled `audit-logs` with retention of 18 months. Ensure bucket object metadata includes the archive timestamp and rotation operator.
- After confirming upload integrity (using the storage service checksum), delete the local archive.
- Do **not** compress logs with personal data before uploading; the storage bucket enforces server-side encryption at rest.

## Automation hooks

Provision a cron (or scheduled task) that runs `logrotate` or an equivalent shell script weekly. The job should:

1. Invoke the rotation steps above (copy, truncate, upload, delete).
2. Emit its own audit entry indicating that rotation occurred (include operator/service account name).
3. Run as a service account with read/write access to the log directory and the storage bucket.
