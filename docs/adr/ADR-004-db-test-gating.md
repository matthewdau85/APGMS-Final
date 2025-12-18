\# ADR-004: Database-backed Test Gating



\## Status

Accepted



\## Context

Certain domain-policy tests validate cryptographic ledger integrity and require

a real database (Prisma + Postgres). Running these unconditionally causes

non-deterministic failures in local and CI environments.



\## Decision

Database-backed tests are gated behind the environment variable `RUN\_DB\_TESTS=1`.

When unset, these tests are explicitly skipped using `describe.skip`.



\## Consequences

\- Unit tests remain fast and deterministic

\- DB tests are opt-in and explicit

\- CI behavior is predictable

\- Operational dependencies are documented



\## Alternatives Considered

\- Always running DB tests (rejected)

\- Mocking database behavior (rejected)



\## Compliance Notes

This approach aligns with DSP expectations for explicit operational controls.



