# DSP Product & Regulatory Tracker

| Item | Reference | Owner | Status |
| --- | --- | --- | --- |
| DSP Product Registration | DSP-APGMS-01 | Compliance Lead | Submitted to ATO portal (2025-02-05) |
| OSF Questionnaire | OSF-2025-APGMS | Security | Complete – see `docs/regulatory/osf-security-questionnaire.md` |
| AUSTRAC Reporting Path | AUSTRAC-REF-8891 | Risk | In-flight – awaiting pilot data confirmation |
| STP Conformance Test | STP-PILOT-12 | Product | Live – `/ato/stp/report` replays nightly pilot runs |

## Pilot ledger evidence

Scripts under `scripts/pilot-data-seeder.ts` run every midnight AEST to ingest payroll/POS captures, reconcile designated accounts, and submit PAYGW/GST transfers. The generated artifacts are stored in `artifacts/pilots/<org>/<timestamp>.json` for regulators.
