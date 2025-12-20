## Control: SDLC-TEST-02 - Database-backed test governance

**Description**  
Database-backed tests are gated to avoid non-deterministic failures in PR and
developer workflows, while preserving full coverage in controlled environments.

**Policy / Decision**
- ADR-004 - Gating DB-backed tests via RUN_DB_TESTS
  (`docs/adr/ADR-004-db-test-gating.md`)

**Evidence**
- EV-012 - Ledger integrity test coverage
  (`docs/evidence/EV-012-ledger-integrity-testing.md`)
- EV-013 - AU tax config provider contract tests
  (`docs/evidence/EV-013-au-tax-config-provider-contract-tests.md`)
- CI Workflow: `.github/workflows/ci.yml`

**Enforcement**
- PRs: RUN_DB_TESTS=0
- Protected branches / nightly: RUN_DB_TESTS=1
