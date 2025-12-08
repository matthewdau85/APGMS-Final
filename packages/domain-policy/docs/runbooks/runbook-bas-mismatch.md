# Runbook: BAS Amount Mismatch (ATO vs APGMS)

## 1. Symptom

- ATO BAS assessment amount does not match:
  - APGMS `obligations` (PAYGW + GST), or
  - actual remitted amounts in the tax ledger, or
  - the last `SettlementInstruction.payloadJson.netPayableCents`

## 2. Quick Triage Checklist

1. Confirm basic identifiers:
   - `orgId`
   - `period` (e.g. `2025-Q3` or `2025-09`)
   - BAS lodgment reference (if available)

2. Check APGMS obligations for that period:
   - Call `computeOrgObligationsForPeriod(orgId, period)` (via dev console or helper)
   - Note:
     - `paygwCents`
     - `gstCents`
     - `breakdown[]`

3. Check ledger remittances:
   - Query `TaxLedgerEntry` for `orgId` + `period`
   - Confirm:
     - Ledger chain is valid: `verifyLedgerChain(orgId, period)` returns `ok=true`
     - Totals via `getLedgerBalanceForPeriod(orgId, period)`
       - Compare PAYGW/GST vs obligations

4. Check settlement instructions:
   - Query `SettlementInstruction` for `orgId` + `period`
   - Look at the latest record:
     - `payloadJson.totalObligationCents`
     - `payloadJson.totalRemittedCents`
     - `payloadJson.netPayableCents`
     - `status` (PREPARED / SENT / ACK / FAILED)

## 3. Root Cause Patterns

### Pattern A: Data entry / configuration error

- **Signal:**
  - `computeOrgObligationsForPeriod` shows different numbers to the ATO BAS.
  - Ledger + SettlementInstruction are internally consistent.

- **Actions:**
  1. Identify which source is wrong:
     - Payroll inputs (PAYGW) vs GST transactions (POS/manual)
  2. If APGMS is wrong:
     - Correct underlying transactions (payroll/gst tables).
     - Issue `ADJUSTMENT` entries into `TaxLedgerEntry` as needed.
     - Re-run `computeOrgObligationsForPeriod` and re-prepare settlement.
  3. If ATO is wrong:
     - Raise an ATO amendment / review (out of scope for APGMS).

### Pattern B: Partial remittance / late remittance

- **Signal:**
  - `obligations` > `ledgerTotals` → positive shortfall.
  - SettlementInstruction `netPayableCents` smaller than ATO BAS due.

- **Actions:**
  1. Confirm whether multiple settlements were intended in the same period.
  2. If yes:
     - Ensure all `SettlementInstruction` records are `ACK`.
  3. If no:
     - Create an `ADJUSTMENT` ledger entry for the shortfall.
     - Prepare a fresh BAS settlement for the remaining amount.

### Pattern C: Ledger chain integrity failure

- **Signal:**
  - `verifyLedgerChain(orgId, period)` returns `ok=false`.
  - Possible tampering or data corruption.

- **Actions:**
  1. Stop automated settlement for that org/period.
  2. Investigate the first invalid index from the verification result.
  3. Restore from backup or reconstruct entries based on bank statements.
  4. Only once `ok=true` again, re-evaluate obligations and settle.

## 4. When to Escalate

- Chain integrity cannot be restored.
- Differences cannot be reconciled to a clear cause.
- ATO has issued penalties or default assessments based on mismatched amounts.

Escalate to:
- Technical: APGMS core team (ledger/settlement owners).
- Business: Tax advisor / accountant for the client org.
