# BAS Settlement Lifecycle (APGMS v0.x)

## 1. Overview

- Entity: `SettlementInstruction`
- Channel: `"PAYTO"` (for now)
- States: `PREPARED → SENT → ACK | FAILED`
- Key actors:
  - API Gateway (`/settlements/bas/*` routes)
  - Future background worker / PayTo adapter
  - External bank / PayTo Mandate

## 2. States and Transitions

### 2.1 PREPARED

**How we enter:**
- `prepareBasSettlementInstruction(orgId, period)` in `domain-policy`
- `POST /settlements/bas/prepare` in API gateway

**What we know:**
- `payloadJson` contains:
  - `orgId`, `period`
  - `totalObligationCents`, `totalRemittedCents`, `netPayableCents`
  - `obligations` (PAYGW + GST + breakdown)
  - `ledgerTotals` (PAYGW / GST / PENALTY / ADJUSTMENT)

**Logs to check:**
- `Prepared BAS settlement` with `settlementId`
- Any errors from obligations/ledger lookups

**Next transition:**
- Worker or API calls `markBasSettlementSent(id)` → `SENT`

### 2.2 SENT

**How we enter:**
- `POST /settlements/bas/:id/sent` (called when PayTo instruction submitted)

**What we know:**
- Instruction has been handed off to bank/PayTo
- Awaiting confirmation of debit result

**Logs:**
- `"BAS settlement sent"` (you can add this later)
- PayTo gateway / worker logs

**Next transitions:**
- `ACK` via `/settlements/bas/:id/ack`
- `FAILED` via `/settlements/bas/:id/failed`

### 2.3 ACK

**How we enter:**
- `markBasSettlementAck(id)` called by:
  - `POST /settlements/bas/:id/ack`

**What we know:**
- PayTo debit succeeded
- BAS amount is fully settled in the designated account

**Logs:**
- `"BAS settlement ACK"` with id, orgId, period

### 2.4 FAILED

**How we enter:**
- `markBasSettlementFailed(id, reason)` via:
  - `POST /settlements/bas/:id/failed`

**What we know:**
- Last attempt failed (insufficient funds, mandate error, etc.)
- `failureReason` contains the last known error text

**Logs:**
- `"BAS settlement FAILED"` with id, orgId, period, reason

**Runbook:**
- See `docs/runbooks/runbook-payto-failed.md`

## 3. API → Domain Mapping

- `POST /settlements/bas/prepare` → `prepareBasSettlementInstruction`
- `POST /settlements/bas/:id/sent`  → `markBasSettlementSent`
- `POST /settlements/bas/:id/ack`   → `markBasSettlementAck`
- `POST /settlements/bas/:id/failed`→ `markBasSettlementFailed`

## 4. Future Extensions

- Add correlation IDs for PayTo gateway
- Persist retry counters, first/last attempt timestamps
- Annotate with ATO BAS reference once lodged
