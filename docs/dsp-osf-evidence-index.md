\## Control: SDLC-TEST-02 – Database-backed test governance



\*\*Description\*\*  

Database-backed tests are gated to avoid non-deterministic failures in PR and

developer workflows, while preserving full coverage in controlled environments.



\*\*Policy / Decision\*\*

\- ADR-004 – Gating DB-backed tests via RUN\_DB\_TESTS



\*\*Evidence\*\*

\- EV-012 – Ledger integrity test coverage

\- CI Workflow: .github/workflows/ci.yml



\*\*Enforcement\*\*

\- PRs: RUN\_DB\_TESTS=0

\- Protected branches / nightly: RUN\_DB\_TESTS=1



