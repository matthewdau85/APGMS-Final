\# EV-012: Ledger Integrity Testing



\## Control Objective

Ensure financial ledger entries cannot be tampered with undetected.



\## Implementation

Ledger entries are chained using cryptographic hashes (`hashSelf`, `hashPrev`).

Integrity is verified using a database-backed test suite.



\## Evidence

\- Test: `tax-ledger.hash.test.ts`

\- Execution gated via `RUN\_DB\_TESTS`

\- CI execution documented



\## Status

Implemented and verified



