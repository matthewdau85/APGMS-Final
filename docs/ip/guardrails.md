# IP guardrails

## Claim: Designated holding accounts are hard-fenced as credit-only safes
- **Code modules**
  - `domain/policy/designated-accounts.ts` rejects non-whitelisted sources, raises `DESIGNATED_WITHDRAWAL_ATTEMPT` alerts, and emits reconciliation audit logs.
  - `services/api-gateway/src/routes/designated-accounts.ts` exposes the credit endpoint, but wraps every request with the policy engine and audit logger used in the domain layer.
- **Alerts & monitoring**
  - High-severity `DESIGNATED_WITHDRAWAL_ATTEMPT` alerts are created via Prisma when any debit attempt occurs, ensuring the regulator console surfaces the violation stream immediately.
- **Evidence artefacts**
  - `domain/policy/designated-accounts.ts` produces `designated-reconciliation` evidence artefacts with 24-hour inflow deltas and SHA-256 hashes that regulators can download from the compliance evidence list.
- **Verification**
  - `services/api-gateway/test/designated-accounts.routes.spec.ts` covers the happy-path credit flow and the blocked path when MFA is missing.

## Claim: BAS lodgment is blocked unless PAYGW and GST obligations are fully funded
- **Code modules**
  - `services/api-gateway/src/routes/bas.ts` calculates current PAYGW/GST exposure by reusing `getDesignatedAccountSummary` from `domain/policy/designated-accounts.ts`, computes shortfalls, and raises `bas_shortfall` conflicts when balances are below obligations.
  - Lodgment updates the backing `BasCycle` record with the reconciled secured totals and records a tamper-evident audit entry via `services/api-gateway/src/lib/audit.ts`.
- **Evidence artefacts**
  - The reconciliation totals persisted on `BasCycle` plus the audit chain provide immutable proof for each lodgment event.
- **Verification**
  - `services/api-gateway/test/bas.routes.spec.ts` asserts that previews flip to `READY` only when designated balances exceed the `BasCycle` requirements, and that lodgment is rejected until MFA succeeds and balances are adequate.

## Claim: Step-up MFA (TOTP or passkey) is required before high-risk treasury actions
- **Code modules**
  - `services/api-gateway/src/routes/auth.ts` issues step-up sessions via `grantStepUpSession` after TOTP, recovery code, or WebAuthn verification.
  - `services/api-gateway/src/routes/bas.ts` and `services/api-gateway/src/routes/designated-accounts.ts` call the shared step-up enforcement to block BAS lodgment or designated account credits without a fresh TOTP/passkey challenge.
- **Alerts & monitoring**
  - `services/api-gateway/src/lib/audit.ts` records `bas.lodged` and `designatedAccount.credit` audit entries, enabling downstream monitoring to trace every privileged operation back to the verified actor and MFA method.
- **Verification**
  - The MFA gating paths are unit-tested in `services/api-gateway/test/bas.routes.spec.ts` and `services/api-gateway/test/designated-accounts.routes.spec.ts`, guaranteeing regressions surface when step-up enforcement changes.
