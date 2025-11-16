# High-Availability Blueprint

This blueprint closes the production-readiness gap by defining the concrete topology required for APGMS to run across multiple availability zones and banks.

## Architecture

1. **Active/Active API gateways** – Deploy two Fastify pods per region (Sydney + Melbourne). The readiness handler (`/ready`) already exposes drain state; use it with rolling deployments.
2. **Bank provider fan-out** – The banking provider registry now includes ANZ, NAB, CBA, and the mock provider. Use Kubernetes node labels to pin pods that talk to ANZ/CBA inside the corresponding private subnets.
3. **NATS and Redis HA** – Run NATS JetStream in clustered mode (3 nodes) and Redis in a managed multi-zone configuration. Health checks in `services/api-gateway/src/app.ts` will surface readiness if either dependency becomes unavailable.
4. **Vault-backed secrets** – The secret hydrator ensures pods never store raw credentials. Configure `SECRETS_PROVIDER=vault` with per-environment KV namespaces.
5. **Disaster recovery** – `scripts/export-evidence-pack.ts` + `scripts/backup-evidence-pack.ts` (via SBOM job) mirror compliance artifacts into WORM storage daily.

## Runbook

1. `pnpm setup:wizard` – capture the org, provider, and designated accounts for each tenant.
2. `pnpm pilot:seed --org <org>` – create the pilot ingestion data and verify `/compliance/precheck`.
3. `pnpm api deploy` (CI job) – deploy the tagged container images to both regions.
4. Use the checklist below before flipping traffic.

### Cutover checklist

- [ ] Vault secrets synced and verified via `scripts/vault-sync.ts`.
- [ ] `/health` and `/ready` return OK in both regions.
- [ ] `/ato/stp/report` returns HTTP 200 for at least one pilot org.
- [ ] Compliance evidence stored in `artifacts/pilots/`.
