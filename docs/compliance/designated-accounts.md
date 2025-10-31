# Designated Account Controls

APGMS enforces the “deposit only” mandate for GST and PAYGW holding accounts.
The controls added in Phase 4.5 cover three pillars:

- **Provider abstraction**  
  The banking layer now routes through provider adapters (`providers/banking/*`),
  enforcing per-integration rate caps. NAB and ANZ adapters share a common policy
  surface so we can register new institutions without touching downstream code.

- **One-way policy engine**  
  The domain policy (`domain/policy/designated-accounts.ts`) only permits credits
  from whitelisted capture sources: `PAYROLL_CAPTURE`, `GST_CAPTURE`, or
  `BAS_ESCROW`. Any debit attempt is rejected, logged, and automatically produces
  a HIGH severity `DESIGNATED_WITHDRAWAL_ATTEMPT` alert for regulator review.

- **Nightly reconciliation artefact**  
  A worker job emits a `designated-reconciliation` evidence artefact, including
  24‑hour inflow deltas and a SHA‑256 hash. Regulator portal users can download
  the artefact from the normal evidence listing, providing auditable proof that
  the holding accounts remained ringfenced.

## Operational Checklist

1. Ensure the following environment variables are set on the API gateway:

   | Variable                        | Purpose                                      |
   | ------------------------------- | -------------------------------------------- |
   | `BANKING_PROVIDER`              | Adapter ID (`nab`, `anz`, `mock`)            |
   | `BANKING_MAX_READ_TRANSACTIONS` | Max transactions fetched per polling window  |
   | `BANKING_MAX_WRITE_CENTS`       | Maximum credit per call (cents)              |

2. Schedule the worker entry point `worker/src/index.ts` to run nightly (e.g. via
   `cron`). The job iterates all organisations and records the reconciliation
   artefact plus audit log entries under `designatedAccount.reconciliation`.

3. Monitor for `DESIGNATED_WITHDRAWAL_ATTEMPT` alerts on the regulator portal.
   Each alert includes metadata describing the blocked request, satisfying the
   “no withdrawals from designated accounts” patent control.

