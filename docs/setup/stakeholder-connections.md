# Stakeholder Connection Tutorial

External stakeholders (banks, regulators, audit partners) can pull compliance
state directly from the APGMS API. This tutorial covers authentication, OAuth
scopes, and example calls for the `/regulator/*` routes that expose audit logs,
compliance status, and bank summaries.

## 1. Prerequisites

* Running API gateway (local or staging) with regulator routes enabled
* `REGULATOR_ACCESS_CODE` configured (see `services/api-gateway/src/config.ts`)
* TLS termination in front of the API when sharing with partners
* Tooling for JWT inspection (curl + jq, Postman, or similar)

## 2. Obtain a regulator session token

1. Generate a one-time access code for the stakeholder (or re-use the configured
   code for pilots).
2. Request a session token:
   ```bash
   curl -XPOST https://<host>/regulator/login \
     -H 'Content-Type: application/json' \
     -d '{"accessCode":"regulator-dev-code","orgId":"demo-org"}'
   ```
3. The response contains a short-lived bearer token and a `sessionId`. Store the
   token securely; it grants access to `/regulator/*` endpoints for the TTL
   defined by `REGULATOR_SESSION_TTL_MINUTES`.

## 3. Call stakeholder endpoints

Use the bearer token in the `Authorization` header. Each route enforces the
`regulator` scope automatically.

### `/regulator/compliance/report`

Returns buffer balances, tier status, forecast deltas, and recent alerts.
```bash
curl -s https://<host>/regulator/compliance/report \
  -H 'Authorization: Bearer <token>' | jq
```

### `/regulator/bank-lines/summary`

Lists the most recent bank-line ingestions and whether PAYGW/GST captures are
current.
```bash
curl -s https://<host>/regulator/bank-lines/summary \
  -H 'Authorization: Bearer <token>' | jq '.rows[0]'
```

### `/regulator/evidence`

Streams the stored artifacts (designated reconciliation hashes, discrepancy
resolutions, compliance exports).
```bash
curl -s https://<host>/regulator/evidence \
  -H 'Authorization: Bearer <token>' | jq '.[0]'
```

### `/regulator/alerts`

Pull outstanding PAYGW/GST discrepancy alerts. Stakeholders can confirm whether
shortfalls were resolved before BAS lodgement.
```bash
curl -s https://<host>/regulator/alerts \
  -H 'Authorization: Bearer <token>'
```

## 4. JWT scopes & validation

* Tokens default to the `regulator` audience (configurable via
  `REGULATOR_JWT_AUDIENCE`). Ensure relying parties validate the `aud` claim.
* Each response includes an `auditId` so you can map API calls to logged actions.
* To revoke a session, rotate the `REGULATOR_ACCESS_CODE` and delete the
  corresponding row from `RegulatorSession` via Prisma/psql until the dedicated
  revoke endpoint ships.

## 5. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `401 regulator_token_missing` | Ensure the `Authorization: Bearer` header is set and not expired. |
| `403 regulator_login_failed` | Verify the access code matches the configured `REGULATOR_ACCESS_CODE`. |
| Empty compliance report | Pass `orgId` in the login body so the session is scoped to an organisation. |
| Evidence download fails | Confirm `ENCRYPTION_MASTER_KEY` is set and the user calling the endpoint has regulator privileges. |

## 6. Sharing with partners

1. Provide stakeholders with this tutorial and a dedicated access code.
2. Run `pnpm smoke:regulator` to capture a baseline trace before inviting them.
3. Store the issued tokens and access window in `artifacts/compliance/partner-info.json`.
4. Encourage partners to pin the API host certificate (onshore hosting proof is
   documented under `docs/compliance/designated-accounts.md`).
