# Banking Integrations

This guide explains how the new `services/banking` adapter layer, sandbox connectors, and automated reconciliation tests work together. Use it when preparing ATO DSP evidence, onboarding a pilot customer, or rotating between sandbox banking partners.

## Adapter Interface

The adapter contract now lives in `services/banking/src/index.ts`. It exports:

- `BankingAdapter`, `PrismaBankingAdapter`, and `SandboxBankingAdapter` with metadata describing certification status, sandbox URLs, and reliability samples.
- `configureBankingAdapter` / `resetBankingAdapterFromEnv` helpers that `shared/src/ledger/designated-account.ts` uses to fetch balances, lock accounts, and log shortfalls without touching production bank feeds.
- Environment variables (`DESIGNATED_BANKING_URL`, `DESIGNATED_BANKING_TOKEN`, `DESIGNATED_BANKING_PARTNER`, `DESIGNATED_BANKING_CERT_STATUS`, `DESIGNATED_BANKING_UPTIME*`) that populate the adapter metadata so compliance can trace which connector processed a transfer.

To swap adapters in code:

```ts
import { SandboxBankingAdapter, configureBankingAdapter } from "@apgms/banking";

configureBankingAdapter(
  new SandboxBankingAdapter({
    baseUrl: process.env.DESIGNATED_BANKING_URL!,
    token: process.env.DESIGNATED_BANKING_TOKEN,
    institution: "Pilot ADI",
  }),
);
```

## Sandbox Connectors

`providers/banking` now includes five connectors that respect the shared policy surface:

| Provider | `BANKING_PROVIDER` value | Sandbox variables |
| --- | --- | --- |
| Mock ledger | `mock` | None – used for demos/tests |
| NAB | `nab` | `NAB_SANDBOX_URL`, `NAB_SANDBOX_TOKEN` (optional) |
| ANZ | `anz` | `ANZ_SANDBOX_URL`, `ANZ_SANDBOX_TOKEN` (optional) |
| CBA | `cba` | `CBA_SANDBOX_URL`, `CBA_SANDBOX_TOKEN` |
| Westpac | `westpac` | `WESTPAC_SANDBOX_URL`, `WESTPAC_SANDBOX_TOKEN` |

The new CBA and Westpac connectors call their sandbox REST APIs before and after every `creditDesignatedAccount` invocation. Failures are logged via `banking-provider: sandbox_notification_failed`, ensuring that operations can match ledger credits with upstream acknowledgements.

## Certification Statuses

Use the following table when updating compliance dossiers:

| Connector | Certification status | Evidence |
| --- | --- | --- |
| Prisma adapter | Not started (internal ledger only) | No external dependency; reference internal Prisma schema |
| NAB | In progress | DSP/ADI paperwork under review; see `status/banking-pilot-plan.md` |
| ANZ | Certified for sandbox-only flows | Store API credentials in `infra/secrets/` |
| CBA | Sandbox certification complete | Capture HTTPS fingerprint + contract in `artifacts/compliance/` |
| Westpac | Awaiting attestation | Provide synthetic transfer logs + pilot notes |

## Setup Checklist

1. Build the adapter service so TypeScript consumers can import it:
   ```bash
   pnpm --filter @apgms/banking build
   ```
2. Set `BANKING_PROVIDER` alongside the provider-specific sandbox variables in `services/api-gateway/.env` (or your deployment secret store).
3. Export `DESIGNATED_BANKING_*` env vars if the ledger should call an external adapter instead of Prisma.
4. Run the automated policy and reconciliation tests:
   ```bash
   pnpm exec tsx --test services/api-gateway/test/designated.policy.spec.ts
   pnpm exec tsx --test services/api-gateway/test/banking.reconciliation.spec.ts
   ```
5. Update `status/banking-pilot-plan.md` after every pilot so we capture the observed reliability metrics and certification notes.

Following this checklist ensures that new sandbox connectors ship with audit trails, automated coverage, and up-to-date certification context.
