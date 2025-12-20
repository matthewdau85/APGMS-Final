\# ADR-004: Database-backed test gating via RUN\_DB\_TESTS



\## Status

Accepted



\## Context

Some domain-policy tests (ledger hash-chain integrity) require a real database

to validate cryptographic chaining and tamper detection.



Running these tests unconditionally causes:

\- Local developer friction

\- CI instability

\- Slower feedback cycles



\## Decision

We gate database-backed tests behind an explicit environment variable:



&nbsp;   RUN\_DB\_TESTS=1



Tests default to being skipped unless explicitly enabled.



\## Consequences

\### Positive

\- Fast default test runs

\- Deterministic CI

\- Clear separation of unit vs integrity tests

\- Explicit audit signal for DB-backed controls



\### Negative

\- Developers must opt-in to DB tests locally



\## Implementation

\- Jest uses `describe.skip` when `RUN\_DB\_TESTS` is unset

\- CI runs DB tests in a dedicated step with Postgres



\## Compliance Notes

This pattern aligns with ATO DSP expectations for:

\- Control isolation

\- Repeatable integrity verification

\- Evidence-based assurance

## CI Enforcement

Database-backed tests execute when:
- `RUN_DB_TESTS=1`
- On protected branches (e.g. `main`)
- On scheduled nightly runs

This ensures ledger integrity and other stateful invariants are
continuously validated without introducing flakiness or cost into
pull-request workflows.

## Evidence

- EV-012: Ledger integrity testing (`docs/evidence/EV-012-ledger-integrity-testing.md`)

## Evidence Index

- DSP OSF evidence index: `docs/compliance/dsp-osf-evidence-index.md`


