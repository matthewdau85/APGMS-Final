# Stakeholder Connection Walkthrough

This tutorial shows banks, regulators, and accountants how to authenticate, call the regulator-focused APIs, and interpret the responses.

## 1. Prerequisites

1. Obtain the deployment base URL (for example `https://api.apgms.example.com`).
2. Ask your APGMS contact for the regulator access code configured through `REGULATOR_ACCESS_CODE` and confirm which organisation ID you are allowed to inspect.
3. Verify the API advertises the `REGULATOR_JWT_AUDIENCE` it expects; tokens issued through `/regulator/login` target that audience and expire after the configured `REGULATOR_SESSION_TTL_MINUTES`.

## 2. Authenticate via `/regulator/login`

Send a POST request that includes the access code and the target organisation ID. The gateway validates the code, looks up the org, and mints both a regulator session and a signed JWT you can reuse on subsequent calls.

```bash
curl -X POST https://api.apgms.example.com/regulator/login \
  -H "Content-Type: application/json" \
  -d '{"accessCode":"<ACCESS_CODE>","orgId":"demo-org"}'
```

The response contains:

```json
{
  "token": "<JWT>",
  "session": {
    "id": "session-123",
    "issuedAt": "2025-01-01T00:00:00.000Z",
    "expiresAt": "2025-01-01T01:00:00.000Z",
    "sessionToken": "opaque-session-token"
  }
}
```

Save the `token` and include it as a Bearer token in every request:

```
Authorization: Bearer <JWT>
```

## 3. Compliance status & BAS history

Use the `Authorization` header from above and call:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://api.apgms.example.com/regulator/compliance/report
```

The response summarises BAS cycles, payment plans, alert counts, next BAS due date, and the GST/PAYGW balances in the designated accounts. Each call records an audit log entry.

## 4. Alert feed

Retrieve current and historical alerts (tier escalations, reconciliation failures, etc.) using:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://api.apgms.example.com/regulator/alerts
```

Every alert shows its ID, type, severity, creation timestamp, and whether it has been resolved.

## 5. Monitoring snapshots

Stakeholders can download the last N monitoring snapshots, which contain the same payload stored in the evidence table:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  'https://api.apgms.example.com/regulator/monitoring/snapshots?limit=5'
```

Use the `limit` query parameter (max 20) to control how many JSON blobs are returned.

## 6. Evidence bundles

1. List the 50 newest evidence artifacts:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     https://api.apgms.example.com/regulator/evidence
   ```
2. Download a single artifact (payload + metadata) by ID:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     https://api.apgms.example.com/regulator/evidence/<artifactId>
   ```
3. Each record includes its immutable SHA-256, WORM URI, and created-at timestamp so you can reconcile it with the shared evidence bundle.

## 7. Bank-line summaries

Use the `/regulator/bank-lines/summary` endpoint to confirm how many bank lines the organisation ingested, the aggregate amount, timestamps for the first/last entries, and the five most recent rows. This helps banks validate that data exports match what APGMS ingested.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://api.apgms.example.com/regulator/bank-lines/summary
```

## 8. Operational best practices

1. Tokens expire according to `REGULATOR_SESSION_TTL_MINUTES`. When you receive a 401 response, repeat the login call to obtain a new token.
2. Every regulator call is written to the audit log with the session ID. Share those IDs with your APGMS contact if you need support; they can trace the request via `regulator.*` audit events.
3. If your access should be restricted to read-only dashboards, request a separate service account so the API gateway can distinguish between regulator auditors and partner engineers.

With these steps, stakeholders can authenticate, explore compliance state, and download evidence without needing internal access to the APGMS deployment.
