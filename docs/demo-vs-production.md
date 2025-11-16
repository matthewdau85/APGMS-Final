# Demo vs Production Capabilities

The Phase 1 demo now mirrors a subset of the production stack so teams can exercise the
most critical flows (ingestion, designated-account policy enforcement, BAS pre-checks,
and reconciliation evidence) without touching the full platform. The following table
summarises the current parity.

| Capability | Demo | Production |
| --- | --- | --- |
| Auth & Idempotency | JWT (`/auth/login`) and `Idempotency-Key` headers enforced on `/demo/transfer`. | Full OAuth/JWT, session MFA, org scoping, idempotency table shared across APIs. |
| Designated accounts | `applyDesignatedAccountTransfer` enforces PAYGW/GST deposits, violation alerts, and audit logs. | Same policy plus nightly coverage checks, partner banking adapter, and regulator evidence feeds. |
| Buffer accounts | PAYGW, GST, PAYGI, clearing and bank accounts match production types/subtypes. | Includes additional ledgers (POS, receivables, etc.) and regulator-only suspense accounts. |
| Payroll ingestion | NATS consumer (`@apgms/ingestion-nats`) processes `payroll.ingested` and writes journals for PAYGW/GST/PAYGI. | HTTP + NATS ingestion with connectors, contribution dedupe, and partner capture telemetry. |
| BAS pre-check | `/demo/transfer` validates PAYGW/GST/PAYGI balances before clearing. | `/compliance/precheck` compares against BAS cycles, pending contributions, alerts shortfalls. |
| Reconciliation evidence | `pnpm --filter @apgms/phase1-demo generate:evidence` produces a JSON artifact with balances + SHA-256. | Nightly worker stores `designated-reconciliation` evidence for all orgs and alerts shortfalls. |
| Forecasting | `/demo/forecast` uses EWMA (α = 0.6) for PAYGW/GST obligations and reports tier status. | `@apgms/shared/ledger/predictive` applies the same EWMA formula across BAS cycles. |
| STP output | `pnpm --filter @apgms/phase1-demo generate:stp` emits a STP-like JSON file listing PAYGW holdings. | Production exports regulator-ready STP payloads via secure evidence packs. |
| UI | Demo API is ready for the lightweight SPA to display balances/forecast and trigger transfers. | Webapp consumes the same shared component library (`packages/ui`) with full accessibility audits. |

## Known Gaps

* Demo tokens are signed with a shared secret and have no MFA. Production integrates with the
  regulator’s IdP and enforces device/session policies.
* PAYGI is tracked in the ledger but not yet part of the designated-account policy surface in
the production stack.
* The demo’s reconciliation evidence is stored locally; production forwards artifacts to the
  regulator’s WORM store with retention policies.
* UI parity is tracked in G1/G2—until the demo SPA lands, developers can hit the Fastify API
  directly using curl or the included scripts.

Refer to `apps/phase1-demo/README.md` (coming soon) or the root `README.md` for instructions on
starting the demo stack alongside NATS and Postgres.
