# Prototype / Demo Setup Guide

Use this guide to spin up the lightweight mock environment that demonstrates PAYGW/GST ingestion, discrepancy handling, and tier escalation without touching real banking providers.

## 1. Install tooling & dependencies

1. Install Node.js 20.11, PNPM 9 via Corepack, Docker, Docker Compose, and (optionally) Playwright browsers. These are the same prerequisites documented in the project README to keep the demo aligned with the real stack.
2. Run `pnpm install --frozen-lockfile` at the repo root to hydrate every workspace package.
3. Build TypeScript artifacts with `pnpm -r build` so CLI scripts, workers, and the API gateway share compiled outputs.

## 2. Start local infrastructure

1. Launch the default services with `docker compose up -d`. This starts Postgres, Redis, the tax-engine stub, the API gateway, worker, and the Vite webapp exactly as defined in `docker-compose.yml`.
2. Apply database migrations: `pnpm db:deploy`. This workspace-level helper proxies to `@apgms/shared`, which bundles Prisma and
   owns the schema file.
3. (Optional) Reset the database by removing the `apgms-final_pgdata` Docker volume when you need a clean slate.

## 3. Seed demo data

1. Execute `pnpm tsx scripts/seed.ts` to create the `demo-org`, seed a founder user (`founder@example.com` / `password123`), and insert sample bank lines using the encryption helpers. The script auto-generates PII key material if none is configured, so it works out of the box.
2. Sign in to the webapp at http://localhost:5173 using the seeded credentials.

## 4. Run sample scenarios

1. **Generate bank lines**: Call the demo endpoint to synthesize POS income and payroll expenses:
   ```bash
   curl -X POST http://localhost:3000/demo/banking/generate \
     -H "Authorization: Bearer <demo-admin-token>" \
     -H "Content-Type: application/json" \
     -d '{"daysBack":7,"intensity":"high"}'
   ```
   The handler inserts encrypted bank lines, updates GST/PAYGW designated accounts, and records an audit log entry.
2. **Run a payroll batch**: After seeding employees, invoke `/demo/payroll/run` to mint payslips, mark the pay run committed, and (optionally) backfill bank lines if `includeBankLines` is set.
3. **Trigger a BAS cycle**: POST to `/bas/lodge` (or use the UI) so the reconciliation engine aggregates GST/PAYGW obligations and records the lodged cycle.
4. **Discrepancy workflow**: Raise shortfalls via `/compliance/precheck` and resolve them through `/compliance/alerts/:id/resolve`. Each action is logged and will appear in regulator evidence exports.
5. **Tier escalation**: Submit POS/payroll contributions via `/ingest/pos` and `/ingest/payroll` with varying payloads. When the predictive model spots an escalation, `/demo/banking/generate` automatically raises a `TIER_ESCALATION` alert and updates `artifacts/compliance/tier-state/<orgId>.json`.

## 5. Mock provider selection

1. Leave `BANKING_PROVIDER=mock` so the ingestion pipeline uses the stub adapter instead of calling real bank APIs.
2. Set `DESIGNATED_BANKING_URL`, `DESIGNATED_BANKING_TOKEN`, and `DSP_PRODUCT_ID` to dummy values; the compliance monitor writes them to `artifacts/compliance/partner-info.json` for auditors, even in demo mode.

## 6. Demo hygiene

1. Re-run `pnpm tsx scripts/seed.ts` whenever you want to reset the bank feed or user account.
2. Stop the stack with `docker compose down` when finished.
3. Delete generated evidence (`artifacts/compliance/*`) if the data should not leave your workstation.

Following these steps gives you a repeatable demo that exercises ingestion, reconciliation, discrepancy management, and regulator evidence flows without touching live financial systems.
