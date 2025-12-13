# Bank Integration Packet – APGMS

Version: 0.1
Last updated: YYYY-MM-DD
Owner: APGMS Team

## Purpose

This document describes how a banking partner integrates with APGMS for settlement, reconciliation, and failure handling. It explains responsibilities, message flows, and operational expectations.

It is intended to be readable by:
- bank integration engineers
- security/compliance teams
- operational stakeholders

## High-level model

APGMS acts as a settlement orchestration layer that:
- receives settlement instructions (e.g., BAS settlement finalisation)
- records a durable instruction ID and lifecycle status
- provides lifecycle transitions (prepared -> sent -> ack/failed)
- supports safe incident operation via service modes

APGMS does not require the bank to change its core ledger. It provides:
- standard API integration
- structured reconciliation artifacts
- clear failure semantics and retry expectations

---

## Integration endpoints (API gateway)

Base URL:
- Production: TBD
- Sandbox/Test: TBD

Authentication:
- All `/api/*` endpoints are protected by the API gateway auth guard (JWT or equivalent).
- Partner must provide valid authorization on each request.

### Settlement initiation

- `POST /api/settlements/bas/finalise`

Purpose:
- Create a settlement instruction for a given BAS period.

Request body (example):
- `period`: `YYYY-Q[1-4]`
- optional `payload`: partner reference fields

Response:
- `201 Created`
- returns `instructionId`, `period`, and optional echoed payload

### Lifecycle transitions (APGMS internal / operator-driven / bank-confirmed)

Depending on the agreed model, lifecycle transitions may be:
- invoked by bank callbacks/webhooks (future)
- invoked by APGMS operator tooling (initial)
- invoked by APGMS automated workers (future)

Representative endpoints (if enabled):
- `POST /api/settlements/bas/:instructionId/sent`
- `POST /api/settlements/bas/:instructionId/ack`
- `POST /api/settlements/bas/:instructionId/failed`

Response:
- `200 OK` and updated status, or `404` if instruction does not exist

---

## Core flows

### Flow A: Successful settlement

1) Partner calls `finalise` for period P
2) APGMS returns `instructionId`
3) Settlement is transmitted to bank rails (implementation-specific)
4) APGMS marks `sent`
5) Bank confirmation received (or reconciled)
6) APGMS marks `ack`

Expected outcomes:
- The instruction has a stable `instructionId`
- The lifecycle ends in `ACK`

### Flow B: Failed settlement

1) Partner calls `finalise`
2) APGMS returns `instructionId`
3) Transmission fails OR bank rejects OR reconciliation fails
4) APGMS marks `failed` (optionally with reason)
5) Partner can re-initiate after remediation (new instruction) OR retry according to agreed idempotency rules

Expected outcomes:
- The instruction lifecycle ends in `FAILED`
- The failure is observable and auditable

---

## Reconciliation

Reconciliation artefacts (initial scope):
- Settlement instruction record: `instructionId`, `period`, timestamps, status
- Optional partner reference payload fields

Reconciliation responsibilities:
- APGMS: provides instruction IDs, status transitions, and logs/records
- Bank: provides settlement confirmation details (reference IDs, posting time, return codes)

Mismatch handling:
- If APGMS shows `SENT` but bank has no record: treat as P1 reconciliation incident; verify transmission logs and re-send according to agreed process.
- If bank posted but APGMS not `ACK`: mark `ACK` after verifying bank reference evidence.

---

## Failure handling, retries, and idempotency

### Failure semantics
- 401/403: authorization issue (partner must remediate credentials/claims)
- 409: service in read-only mode (writes blocked)
- 503: service suspended (writes blocked, possibly all operations blocked for guarded route groups)
- 4xx (validation): request invalid (partner must fix request)
- 5xx: APGMS error (APGMS investigates)

### Retries
Partner retry policy:
- Retry on 503 and 5xx with exponential backoff and jitter
- Do not retry on 4xx validation errors
- For 409 read-only: pause and retry after operational clearance

Idempotency (recommended):
- Partner should include an idempotency key (future enhancement if not implemented)
- APGMS should support idempotent “finalise” for same period + key (future enhancement)

---

## Operational modes (incident switch)

APGMS supports three service modes:
- `normal`: operations proceed as standard
- `read-only`: reads permitted; writes blocked (409)
- `suspended`: service suspended (503) for guarded operations

Partner expectations:
- During read-only/suspended, partner should pause settlement initiation and follow incident comms.
- APGMS will communicate mode changes and expected restoration windows.

---

## Security & compliance expectations

- Transport: TLS required
- Authentication: JWT/OIDC or agreed mechanism
- Logging: partner must support correlation IDs where feasible
- Data minimization: only required settlement fields should be transmitted

---

## Responsibilities matrix

| Area | APGMS | Bank partner |
|---|---|---|
| Auth config | Define claims/issuer/audience requirements | Provide valid credentials and token handling |
| Settlement initiation | Provide endpoint + validation + instructionId | Call endpoint, supply correct data |
| Transmission to rails | Implementation-specific (TBD) | Implementation-specific (TBD) |
| Reconciliation evidence | Provide APGMS-side instruction history | Provide bank-side posting/ref evidence |
| Incident response | Declare mode changes, provide status updates | Pause writes, follow comms, assist reconciliation |

---

### Identity validation (ABN/TFN)

- ABN validation: When a partner registers/updates an ABN, APGMS validates the ABN format and verifies it via the ABR lookup integration (configured per environment).
- TFN handling: APGMS does not “verify TFNs” against ATO systems. TFNs are treated as highly sensitive. Where TFN input exists, APGMS validates format/checksum only and partners remain responsible for collecting and storing TFNs in their own compliant systems.

### Risk-based behaviour (deletion and retention)

APGMS applies risk constraints to destructive actions:

- If a record is constrained by audit/ledger/settlement retention requirements, APGMS will anonymise (remove PII) rather than hard delete.
- If no constraints exist, hard delete may occur.
- Admin delete responses explicitly indicate the action taken (ANONYMISED vs HARD_DELETED).


## Onboarding checklist

1) Exchange sandbox endpoint + auth configuration
2) Run partner integration tests against sandbox
3) Validate settlement finalise flow
4) Validate expected failure codes (401/409/503)
5) Confirm reconciliation outputs and evidence expectations
6) Production cutover + monitoring validation
