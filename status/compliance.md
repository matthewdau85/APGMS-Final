# Compliance Status Snapshot

Last updated: 2025-11-08T04:33:21Z

## Control evidence

- **Control map** – See `docs/compliance/control-maps.md` for control ⇾ implementation ⇾
  test linkage.
- **DPIA summary** – `docs/compliance/dpia-summary.md` outlines processing scope,
  risks, and mitigations.
- **Regulator SOP** – `docs/compliance/regulator-sop.md` governs onboarding and
  offboarding workflows.
- **Retention SOP** – `docs/compliance/retention-worm-sop.md` covers WORM promotion
  and deletion evidence.

## Latest verification runs

Record command output below when you execute the evidence workflow:

- `pnpm --filter services/api-gateway test -- --test-name-pattern "security\|auth\|pii\|designated"`
  - Result: _pass/fail_
  - Evidence: `artifacts/compliance/<release>.md`
- `pnpm smoke:regulator`
  - Result: _pass/fail_
  - Evidence: `artifacts/compliance/<release>.md`
- `pnpm lint:markdown`
  - Result: _pass/fail_
  - Evidence: `artifacts/compliance/<release>.md`

## Outstanding actions

- [ ] Rotate regulator access code (`docs/compliance/regulator-sop.md`).
- [ ] Review retention evidence and confirm WORM promotion
      (`docs/compliance/retention-worm-sop.md`).
- [ ] Re-run DPIA assessment if new data categories are introduced
      (`docs/compliance/dpia-summary.md`).
