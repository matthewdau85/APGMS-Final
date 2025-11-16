# Payments & Banking Provider Configuration

APGMS ships with a configurable banking abstraction so the same ingestion and
ledger code can speak to NAB, ANZ or the mock provider that powers demos. This
runbook walks through the runtime knobs, sandbox onboarding guidance, and
per‑bank capability limits.

## Environment variables

Set these variables anywhere the API gateway runs (local `.env`, container
secrets, CI/CD variables, etc.). Defaults are shown in parentheses.

| Variable | Description |
| --- | --- |
| `BANKING_PROVIDER` (`mock`) | Provider identifier. Supported values: `nab`, `anz`, `mock`. |
| `BANKING_MAX_READ_TRANSACTIONS` (`1000`) | Maximum transaction rows the provider may request per poll. Used to cap ingestion jobs. |
| `BANKING_MAX_WRITE_CENTS` (`5000000`) | Maximum credit (in cents) that APGMS will attempt for a single transfer. |
| `DESIGNATED_BANKING_URL` | HTTPS base URL for the partner’s designated account API. Required outside the mock adapter. |
| `DESIGNATED_BANKING_TOKEN` | Bearer/API token issued by the bank or adaptor. Store in a secret manager. |
| `DESIGNATED_BANKING_CERT_FINGERPRINT` | Optional SHA‑256 pin for mTLS endpoints. |
| `BANKING_TIMEOUT_MS` (`10000`) | Upstream HTTP timeout for provider clients. |

## Provider capability defaults

| Provider | `maxReadTransactions` | `maxWriteCents` | Notes |
| --- | --- | --- | --- |
| NAB | 1,000 | 5,000,000 | Designed around NAB API sandbox pagination and AUD $50k per‑transfer limit. |
| ANZ | 800 | 4,000,000 | Aligns with ANZ sandbox throttles; lower cap keeps demo traffic within default limits. |
| Mock | 200 | 1,000,000 | Safe values for local prototypes; configurable for stress tests. |

Override the caps via `BANKING_MAX_*` or by calling
`createConfiguredBankingProvider({ id, capabilities })` when embedding the
provider inside custom tooling.

## Per-bank setup guidance

### NAB

1. **Sandbox access** – request access via the NAB API developer portal.
   They provision client IDs, secrets, and mock accounts within one business
   day for registered DSPs.
2. **Credentials** – store the issued API key or OAuth token under
   `DESIGNATED_BANKING_TOKEN`. Configure webhook callbacks to point at your
   gateway’s `/bank-lines` endpoint.
3. **Networking** – allow egress to `https://sandbox.api.nab.com.au` and the
   TLS intermediates listed in NAB’s trust bundle. Pin the SHA‑256 of the
   sandbox cert via `DESIGNATED_BANKING_CERT_FINGERPRINT` if policy requires it.
4. **Timeouts** – start with `BANKING_TIMEOUT_MS=10000`. NAB throttles after
   ~50 concurrent requests; keep the worker concurrency low during pilots.

### ANZ

1. **Sandbox signup** – file an application through ANZ’s New Payments
   Platform partner portal. Request both PAYGW and GST scopes.
2. **Credentials** – ANZ issues API keys per environment. Export the key as
   `DESIGNATED_BANKING_TOKEN` and add the base URL to
   `DESIGNATED_BANKING_URL` (usually `https://api.anz.com/sandbox`).
3. **TLS and IP allow‑listing** – ANZ requires static egress IPs. Route APGMS
   traffic through your corporate NAT or Cloud NAT so the address matches the
   allow‑list request.
4. **Polling limits** – keep `BANKING_MAX_READ_TRANSACTIONS` ≤ 800 so the
   nightly reconciliation job never exceeds ANZ’s per-call payload limit.

### Mock provider

Use the mock adapter for demos and the prototype environment.

1. Leave `BANKING_PROVIDER=mock`. The API gateway will skip outbound calls and
   write transfers directly to the in-memory ledger.
2. Set `DESIGNATED_BANKING_URL`/`TOKEN` to descriptive placeholder values so
   dashboards and audit logs still show which “provider” handled the run.
3. Bump `BANKING_MAX_WRITE_CENTS` temporarily when simulating large PAYGW or
   GST deposits.

## Sandbox credential checklist

Regardless of the provider:

1. Document the API key request in `artifacts/compliance/partner-info.json`.
2. Save the onboarding email (usually contains callback URLs, SLA notes, and
   certificate fingerprints) under `artifacts/compliance/` for regulators.
3. Run `curl -sf $DESIGNATED_BANKING_URL/health` (or the provider’s equivalent)
   before pointing APGMS at the sandbox, then record the output alongside the
   provisioning ticket.
4. After the first successful credit, export the audit log via
   `/regulator/evidence` and include it in your DSP OSF evidence pack.
