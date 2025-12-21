\# APGMS Testing Policy



This document defines the \*\*authoritative testing strategy\*\* for the APGMS monorepo.



This policy is intentional and enforced.



---



\## 1. Package Categories



APGMS packages fall into two categories:



\### A. Domain Packages

Examples:

\- `packages/domain-policy`



Characteristics:

\- Pure business logic

\- Deterministic

\- Replayable

\- No IO, no network, no persistence



\*\*Requirements\*\*

\- Unit tests are mandatory

\- Coverage is mandatory

\- Coverage uses Node V8 only

\- Coverage thresholds may be enforced



---



\### B. Infrastructure Packages

Examples:

\- `packages/ledger`

\- `services/api-gateway`

\- `worker`

\- connectors, adapters, persistence layers



Characteristics:

\- IO-bound

\- Framework-heavy

\- Environment-dependent

\- Integration-oriented



\*\*Requirements\*\*

\- Unit tests are mandatory

\- Coverage is NOT required

\- Coverage MUST NOT be enabled in CI

\- Stability > coverage percentage



This avoids known Jest + Node + coverage failure modes and reflects real signal value.



---



\## 2. Coverage Rules (Non-Negotiable)



\- Coverage is \*\*only\*\* collected for domain packages

\- Infrastructure packages must not run with `--coverage`

\- Babel/Istanbul must never be reintroduced



---



\## 3. How Tests Are Run



Locally and in CI, \*\*tests are run via one command\*\*:



```bash

pnpm verify



