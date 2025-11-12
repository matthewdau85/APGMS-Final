# Designated Account Controls

APGMS enforces the “deposit only” mandate for GST and PAYGW holding accounts.
The controls added in Phase 4.5 cover three pillars:

- **Provider abstraction**  
  The banking layer now routes through provider adapters (`providers/banking/*`),
  enforcing per-integration rate caps. NAB and ANZ adapters share a common policy
  surface so we can register new institutions without touching downstream code.

- **One-way policy engine**  
  The domain policy (`packages/domain-policy/src/designated-accounts.ts`) only permits credits
  from whitelisted capture sources: `PAYROLL_CAPTURE`, `GST_CAPTURE`, or
  `BAS_ESCROW`. Any debit attempt is rejected, logged, and automatically produces
  a HIGH severity `DESIGNATED_WITHDRAWAL_ATTEMPT` alert for regulator review.
  Alerts carry the pre-defined message `Designated accounts are deposit-only; debits are prohibited`,
  matching the policy violation so regulators can immediately understand why the transfer failed.

- **Nightly reconciliation artefact**  
  A worker job emits a `designated-reconciliation` evidence artefact, including
  24‑hour inflow deltas and a SHA‑256 hash. Regulator portal users can download
  the artefact from the normal evidence listing, providing auditable proof that
  the holding accounts remained ringfenced.

Regulators can open the evidence center (webapp/src/RegulatorEvidencePage.tsx) to browse designated-reconciliation entries sorted by createdAt, view the persisted SHA-256 and wormUri, and click the built-in Verify button (which recomputes the hash client-side) before handing the artefact to auditors.

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

## Phase 1: Pillar Baseline

| Pillar | Success Criteria | Phase 1 Tasks |
| --- | --- | --- |
| Provider abstraction | Every banking adapter (`providers/banking/*`) implements the shared interface, respects per-provider rate caps, and can register without downstream changes. | Audit `providers/banking` and the connector wiring for caps/ratios, add a regression test that exercises a mock provider to prove the shared surface is reusable, log per-provider credit attempts plus capped warnings via the new `banking-provider` events, and coordinate a compliance/ops/engineering checkpoint so stakeholders agree when the pillar is “5/5”. |
| One-way policy engine | `@apgms/domain-policy` is the sole enforcement point for deposits, only allows `PAYROLL_CAPTURE`, `GST_CAPTURE`, and `BAS_ESCROW`, and logs the documented `DESIGNATED_WITHDRAWAL_ATTEMPT` message. | Review `packages/domain-policy/src/designated-accounts.ts` plus every caller to ensure the policy is always invoked, extend policy unit tests to cover each violation path, and verify alerts contain the metadata regulators expect. |
| Nightly reconciliation artefact | The nightly worker (`worker/src/jobs/designated-reconciliation.ts`) runs for all orgs, emits a `designated-reconciliation` evidence entry with SHA-256 hash, and records audit log entries for traceability. | Confirm the worker job writes the audit log entries, ensure `generateDesignatedAccountReconciliationArtifact` persists the hash/payload, and document how to retrieve the artefact from the evidence listing. |

Phase 1 completes once these audits/tests have produced measurable indicators that can be reviewed when rating each pillar 5/5.



