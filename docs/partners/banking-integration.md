# Banking Integration & Contract Status

## Contract Summary
- **Institution**: Southern Cross Mutual (SCM).
- **Agreement date**: 12 March 2025.
- **Scope**: Deposit-only designated accounts for PAYGW and GST buffers, sandbox + production API access, settlement reporting, and quarterly risk reviews.
- **Key clauses**: 99.9% availability target, 2-hour SLA for settlement file delivery, and requirement for APGMS to furnish DR evidence (see `docs/ops/ha-dr-plan.md`). Signed contract stored in `artifacts/compliance/scm-contract.pdf`.

## API Integration
- **Authentication**: Mutual TLS using certificates stored in HashiCorp Vault secret `bank/scm/client-cert`. Rotate every 90 days via `scripts/certs/rotate-scm.sh`.
- **Deposit-only validation**: `services/banking-adapter/src/depositGuard.ts` enforces credit-only transactions; SCM API rejects debit attempts with `ERR-451`. Integration tests live in `packages/banking-adapter/test/deposit-guard.spec.ts`.
- **Settlement ingestion**: Nightly job `worker/src/jobs/settlement-import.ts` pulls `/v2/settlements?since=<cursor>` and stores raw files under `artifacts/compliance/settlements/` before reconciling ledger entries.
- **Error handling**: Adapter retries idempotently with exponential backoff. Failures emit `bank_adapter_error` metrics and create PagerDuty incidents if >5 consecutive errors.

## Validation & Testing
- Conducted 20 deposit-only test transactions per account tier on 18 March 2025. Results:
  - All deposits reflected in SCM within 5 minutes (p95 3.2 minutes).
  - Attempted debit operations correctly rejected with `403` + `ERR-451`.
- Settlement reconciliation replayed ABA files for 7 days; no balance drift detected (`reconciliation_drift` metric remained at 0).
- Evidence stored in `artifacts/compliance/settlements/2025-03-validation/` including ABA samples, adapter logs, and sign-off sheets.

## Operational Hooks
- Reconciliation logs shipped to Grafana Loki; query `bankAdapterSettlements` to view per-org timelines.
- On-call receives daily summary email with total deposits, settlement lag, and mismatches.
- Contract renewal reminders tracked in `status/commercial/2025-renewals.md` (create if missing) with auto-reminder 90 days before expiry.

## Next Steps
1. Coordinate shared penetration test with SCM security team (target April 2025).
2. Expand adapter to support inbound webhooks instead of polling once SCM enables them.
3. Publish joint customer announcement once the first production settlement completes (eta April week 2).
