# Real App Deployment Guide

This guide walks through deploying the production-ready APGMS stack with real banking providers, TLS, observability, and compliance evidence.

## 1. Prerequisites

1. Install Node.js 20.11, PNPM 9 (via Corepack), Docker, and Docker Compose on the build host. These match the versions enforced in the repository quickstart so CI/CD and local smoke runs stay consistent.
2. Ensure the CLI machine can run `pnpm`, `docker compose`, and `curl` against the production network segment.
3. Provision infrastructure (PostgreSQL 16, Redis 7, and the tax-engine) in the target region or prepare to run the provided containers.

## 2. Architecture overview

The default `docker-compose.yml` file shows the minimum services that must exist in production: Postgres for state, Redis for caching/session data, the tax-engine service, the Fastify API gateway, the worker (same image with worker entrypoint), and the Vite webapp. Use the compose definitions as the blueprint for Kubernetes manifests or Terraform modules so health probes, dependencies, and environment variables stay aligned.

## 3. Secrets and configuration

1. Start from the environment template documented in `README.md` and set every variable (CORS, database URLs, auth, regulator settings, designated banking IDs, and the banking provider caps). All of these must exist in the runtime environment before `services/api-gateway` will boot.
2. For production, set `SECRETS_PROVIDER=vault` (or another supported secret manager) and provide `VAULT_ADDR`, `VAULT_TOKEN`, and `VAULT_NAMESPACE` if required. The gateway will fetch secrets dynamically instead of reading from `.env` once those values are present.
3. Store PII keys (`PII_KEYS`, `PII_SALTS`, and the `*_ACTIVE_*` selectors), `ENCRYPTION_MASTER_KEY`, and JWT material in the vault. Rotate them with `pnpm security:rotate-keys --write-env .env` and mirror the runbook in `docs/runbooks/secrets-management.md` so audit trails stay intact.
4. Set `REQUIRE_TLS=true` whenever the service is exposed outside a trusted network; the gateway enforces HTTPS-only requests under that flag.

## 4. Banking provider configuration

1. Declare which adapter to load through `BANKING_PROVIDER`. Supported IDs today are `nab`, `anz`, and `mock`, each mapping to the provider classes in `providers/banking`. The factory in `providers/banking/index.ts` picks the class and enforces the max read/write limits published in each adapter file.
2. Populate provider-specific credentials (client IDs, TLS certificates, OAuth secrets) in the vault. Reference them from env vars such as `DESIGNATED_BANKING_URL`, `DESIGNATED_BANKING_TOKEN`, and `DESIGNATED_BANKING_CERT_FINGERPRINT` so compliance workflows can log partner metadata.
3. Confirm the connector runbooks for each bank list the rate limits and authentication flow before rolling to production.

## 5. Deployment steps

1. Build artifacts on a clean runner:
   ```bash
   pnpm install --frozen-lockfile
   pnpm -r build
   pnpm -r test -- --coverage
   ```
2. Publish container images (or use `docker compose build`) for the API gateway, worker, and webapp.
3. Provision databases and apply schema migrations from the repository root:
   ```bash
   pnpm db:deploy
   ```
   This script targets the `@apgms/shared` workspace (where Prisma and `prisma/schema.prisma` live) so the CLI resolves the
   correct schema and bundled Prisma binary even though the root workspace itself is Prisma-free.
4. Set the runtime environment (env vars, secret manager bindings, TLS certificates) on your orchestrator and launch the services. Use `pnpm --filter @apgms/api-gateway start` and the equivalent `start` scripts for other packages inside your containers to ensure they run the compiled `dist` output.
5. Register cron jobs for reconciliation, discrepancy detection, or other worker-only tasks by reusing the worker command shown in `docker-compose.yml` (`pnpm --filter worker exec tsx src/index.ts`).

## 6. TLS, networking, and observability

1. Terminate TLS at a load balancer or service mesh and forward traffic to the gateway. When `REQUIRE_TLS=true`, any plain HTTP requests are rejected, so keep TLS termination either at the gateway or immediately upstream.
2. Configure `@opentelemetry/sdk-node` exporters through the standard OTLP environment variables so distributed traces reach your collector. The gateway already ships with the OpenTelemetry SDK dependency; enabling it is a matter of setting OTLP URLs and API keys in the secret manager.
3. Expose `/ready`, `/health`, and `/metrics` through your ingress only to internal callers or monitoring networks. Prometheus scrapes `/metrics`, while uptime probes can hit `/ready`.

## 7. Smoke tests & evidence

1. After every deploy, run:
   ```bash
   curl -sf https://your-api.example.com/health
   curl -sf https://your-api.example.com/ready
   curl -sf https://your-api.example.com/metrics
   ```
   Any non-zero exit indicates misconfiguration.
2. Capture compliance evidence with the scripts listed in `README.md` (coverage, audit scans, SBOM) and upload the resulting `artifacts/compliance/<timestamp>` directory alongside the OSF evidence pack.

Following these steps yields a production-ready deployment with managed secrets, real banking connectors, TLS enforcement, and repeatable smoke/evidence workflows.
