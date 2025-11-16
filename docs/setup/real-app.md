# Real App Deployment Guide

This guide shows how to launch the full APGMS stack against a real (or sandbox)
banking provider. Follow it when wiring NAB/ANZ sandboxes, on-prem pilots, or a
staging environment that mirrors production.

## Prerequisites

* Node.js 20.11.x (`nvm use` or `asdf install`)
* PNPM 9 via Corepack (`corepack enable && corepack prepare pnpm@9 --activate`)
* Docker + Docker Compose for Postgres/Redis
* OpenSSL or mkcert to generate TLS material for reverse proxies
* Access to the bank sandbox (API key, base URL, callback IP allow-list)

## 1. Bootstrap infrastructure

1. Clone the repo and install dependencies:
   ```bash
   git clone git@github.com:example/apgms.git
   cd apgms
   pnpm install --frozen-lockfile
   ```
2. Launch data stores:
   ```bash
   docker compose up -d db redis
   pnpm -w exec prisma migrate deploy
   ```
3. If you deploy to cloud environments, provision Postgres/Redis using your IaC
   stack and export `DATABASE_URL`, `SHADOW_DATABASE_URL`, and `REDIS_URL` with
   the managed endpoints.

## 2. Configure environment variables

Create `services/api-gateway/.env` (or inject secrets via your orchestrator).
Key variables:

| Variable | Description |
| --- | --- |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of UI origins allowed to call the API. |
| `DATABASE_URL`, `SHADOW_DATABASE_URL` | Connection strings for Prisma. |
| `AUTH_AUDIENCE`, `AUTH_ISSUER`, `AUTH_JWKS` | Identity provider metadata. Provide a JWKS URL or inline JSON. |
| `AUTH_DEV_SECRET` | Dev-only HMAC secret when JWKS is unreachable. |
| `ENCRYPTION_MASTER_KEY` | Base64 key for encrypting regulator exports. |
| `REGULATOR_*` | Access code, JWT audience, and session TTL for `/regulator/*` APIs. |
| `BANKING_PROVIDER` | `nab`, `anz`, or `mock`. |
| `BANKING_MAX_READ_TRANSACTIONS`, `BANKING_MAX_WRITE_CENTS` | Cap ingestion + write volume per provider. |
| `DESIGNATED_BANKING_URL` | HTTPS base for the bank adaptor (e.g. `https://sandbox.api.nab.com.au`). |
| `DESIGNATED_BANKING_TOKEN` | API key / bearer token issued by the bank. |
| `DESIGNATED_BANKING_CERT_FINGERPRINT` | Optional SHA‑256 pin for mTLS endpoints. |
| `WEBAUTHN_*` | Relying-party metadata for admin MFA. |
| `NATS_URL`, `REDIS_URL` | Optional external dependencies for queueing/session storage. |

Use `docs/payments.md` for provider-specific requirements and capability tables.

## 3. TLS & ingress

1. Place APGMS behind a TLS terminator (nginx, Envoy, ALB, etc.).
2. Generate certificates via your corporate PKI or `mkcert` for local staging.
3. Set `HOST=0.0.0.0` and `PORT=3000` (or another internal port). Terminate TLS
   at the proxy and forward requests to the gateway. Ensure `/ready` and
   `/metrics` remain authenticated or IP restricted.
4. Record the certificate fingerprint under `artifacts/compliance/partner-info.json`.

## 4. Launch the services

```bash
pnpm -r build
pnpm --filter @apgms/api-gateway dev    # or start via your process manager
```

For production, build the TypeScript output and start with a process manager or
container runtime:

```bash
pnpm --filter @apgms/api-gateway build
node services/api-gateway/dist/index.js
```

## 5. Verify the deployment

1. Health + readiness:
   ```bash
   curl -sf https://<your-host>/ready
   curl -sf https://<your-host>/metrics
   ```
2. Banking config: hit `/compliance/status` with an authenticated user. The
   response should include `bankingProvider` metadata referencing `nab` or `anz`.
3. Run the smoke script to ingest sample lines:
   ```bash
   pnpm k6:smoke -- --env BASE_URL=https://<your-host>
   ```
4. Use `/regulator/bank-lines/summary` to confirm the ledger sees credits.

## 6. Troubleshooting

| Symptom | Action |
| --- | --- |
| `/ready` returns 503 with `draining=true` | Ensure no other instance is shutting down, or restart the process. |
| `banking_write_cap_exceeded` | Increase `BANKING_MAX_WRITE_CENTS` if your bank allows larger transfers. |
| `designated_untrusted_source` | Confirm ingestion payloads set `source` to `PAYROLL_CAPTURE`, `GST_CAPTURE`, or `BAS_ESCROW`. |
| TLS handshake failures | Verify the proxy trusts the bank adaptor’s certificate bundle and that `DESIGNATED_BANKING_CERT_FINGERPRINT` matches the sandbox cert. |
| Regulator login rejected | Check `REGULATOR_ACCESS_CODE` and JWT audience; re-run `pnpm smoke:regulator` for validation. |

## 7. Evidence pack

Before handing the environment to stakeholders:

1. Run `pnpm compliance:evidence` to collect coverage, SBOM, secret scan, and
   readiness outputs.
2. Store the generated zip plus `/ready` + `/metrics` responses under
   `artifacts/compliance/<timestamp>/`.
3. Document the deployment (provider, DSP product ID, certificate hashes) in
   `docs/runbooks/stakeholder-connect.md`.
