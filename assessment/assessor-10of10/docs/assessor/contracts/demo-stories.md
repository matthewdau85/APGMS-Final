# Demo stories (prototype)

These stories define what the prototype must demonstrate, using deterministic fixtures.

Story A: "Pay event -> ledger -> BAS gating"
- Create org (demo org)
- Ingest payroll event (SIMULATED)
- Validate and write to ledger
- Show BAS period state
- Attempt settlement before BAS gate (must be blocked)
- Mark BAS as lodged (SIMULATED)
- Settle and produce remittance/export payload
- Read audit trail for the full journey

Story B: "Stakeholder connectors are simulated and explicitly labeled"
- Demonstrate that all external integrations run in SIMULATED mode
- Evidence: UI labels + API response fields + audit notes

Story C: "Regulator evidence pack"
- Run pnpm compliance:evidence and show resulting artifacts/compliance/<tag>.md
