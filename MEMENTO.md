# Memento for Next Agent

## Current Status
- Database migrations, services, front-end flows, documentation, and Playwright specs for payment plans and forecasting snapshots have been added but are still uncommitted.
- Services compile individually (`pnpm --filter @apgms/payment-plans build`, `pnpm --filter @apgms/forecasting build`).

## Outstanding Issues
1. **Playwright dev server**: `pnpm exec playwright test --project=e2e` fails immediately because the Vite dev server launched by Playwright (`pnpm --filter @apgms/webapp dev -- --host ...`) exits early.
2. **Shared package build**: `shared/src/ledger/designated-account.ts` contains invalid `# locked: boolean;` syntax that breaks `pnpm --filter @apgms/shared build`.
3. **Testing**: No automated tests (unit or Playwright) have succeeded yet with the new features.
4. **Migrations pipeline**: New SQL migrations live under `db/migrations`; confirm downstream tooling runs them.

## Suggested Next Steps
- Investigate the `webapp` dev server logs when Playwright launches to determine why Vite shuts down.
- Fix the invalid syntax in `shared/src/ledger/designated-account.ts` so shared can compile again.
- Re-run Playwright after the server is stable and consider backend integration tests for the new endpoints.
- Coordinate with infra to ensure new migrations are applied in the correct order.

Good luck!
