# STP Phase 2 Pilot Results (Captured 2025-02-26)

## Overview
- **Environment:** Local compliance sandbox (`docker-compose` stack + seeded payroll data)
- **Data sources:** `/ingest/payroll`, `/ingest/pos` synthetic payloads defined in `tests/data/pilot/`
- **Organisations tested:**
  1. Koru Retail Pty Ltd (PAYGW + GST obligations)
  2. Finch Manufacturing Pty Ltd (PAYGW only, seasonal payroll)
- **Goal:** Demonstrate STP Phase 2 readiness, BAS buffer integrity, and alert remediation workflow end-to-end.

## Scenario matrix
| Scenario | Org | Steps | Expected outcome | Result |
| --- | --- | --- | --- | --- |
| STP-01 | Koru Retail | Submit payroll + PAYGW buffer via `/ingest/payroll`; run `/compliance/precheck` | Precheck returns `status: ready`, designated transfer scheduled | ✅ Pass |
| STP-02 | Koru Retail | Force PAYGW shortfall by omitting final pay run; rerun precheck | `/compliance/precheck` returns `status: shortfall` with remediation hints | ✅ Pass |
| STP-03 | Finch Manufacturing | Submit POS GST data + payroll; monitor `/compliance/status` | Pending contributions cleared and BAS reminder updated | ✅ Pass |
| STP-04 | Finch Manufacturing | Replay ingestion with same `Idempotency-Key` | System returns 200 with `Idempotent-Replay: true` header | ✅ Pass |
| STP-05 | Both orgs | Run `/compliance/alerts/:id/resolve` after remediation evidence uploaded | Alerts transition to `resolved` with evidence pointer stored | ✅ Pass |

## Logs & payloads
- Request/response logs saved under `artifacts/compliance/pilots/2025-02-26/*.json` (git-ignored; referenced in liaison review notes).
- Alert lifecycle entries available via `/compliance/status` exports captured in `artifacts/compliance/pilots/2025-02-26/alerts.csv`.
- BAS reminder screenshot stored in the same folder for regulator demos.

## Follow-up items
1. **Auditor replay instructions** – Added to `runbooks/compliance/ato-dsp-registration.md` to satisfy liaison feedback.
2. **Automation** – Schedule nightly pilot replay (synthetic data) via CI job to populate fresh evidence before quarterly audit window.
3. **Dashboard linkage** – Embed STP scenario IDs into compliance dashboard cards (tracked via ticket OPS-2386).
