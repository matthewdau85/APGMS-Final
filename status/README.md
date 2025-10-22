# Status site

This folder tracks the operational playbook for our public status updates. We do not yet ship a dedicated status application; instead we publish Markdown updates from this repository whenever customer-facing issues occur.

## Signals we monitor
- **API gateway health** – `GET /health` must return `{ ok: true }` from the gateway service. See [`services/api-gateway/src/app.ts`](../services/api-gateway/src/app.ts#L65-L107).
- **Automated build coverage** – the [`CI` workflow](../.github/workflows/ci.yml#L1-L44) runs full builds and tests on each change. Breakages here block deploys and should be mentioned in the status page if production is affected.
- **Security automation** – the lightweight [`Security` workflow](../.github/workflows/security.yml#L1-L9) runs on every push and signals when scheduled scans fail to launch.

## Routine publishing process
1. Confirm the scope by checking the health endpoint and reviewing the latest CI run for red/yellow jobs.
2. Create (or update) a Markdown entry under `status/incidents/` with the timestamp, impact, and remediation notes. The entry becomes the customer-facing source of truth.
3. Commit the update and open a pull request titled `Status: <summary>`. Link supporting metrics, logs, or related incidents.
4. After merge, ask the on-call comms lead to broadcast the link to customers.

## Incident response steps
1. **Triage** – Capture alerts, verify `/health`, and inspect recent deploys or database changes.
2. **Stabilize** – Roll back or disable the offending feature (see [`services/api-gateway/src/app.ts`](../services/api-gateway/src/app.ts#L84-L164) for admin rollback endpoints) and confirm CI passes on the hotfix branch.
3. **Communicate** – Post an initial status update via the process above, referencing incident artifacts and expectations for resolution times.
4. **Resolve** – When mitigated, add a resolution section to the same incident file describing the fix and referencing follow-up tickets.
5. **Post-incident** – File cleanup tasks (e.g. improving validation as noted in [ASVS mapping](../docs/security/ASVS-mapping.md)) and schedule a retro within two business days.
