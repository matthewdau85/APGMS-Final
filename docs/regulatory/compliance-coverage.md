# Compliance Coverage Matrix (100%)

| Pillar | Control Evidence | Status |
| --- | --- | --- |
| Core patent claims | `providers/banking/*.ts` now include ANZ, NAB, CBA, and Westpac adapters plus the automated onboarding wizard/PayTo uploader so every bank path uses the deposit-only ledger policy. | ✅ Complete |
| Security claim | Vault hydration + `pnpm setup:payto` means no shared secrets or mandates live in `.env` files and every automation call is recorded for investigators. | ✅ Complete |
| Innovation stretch | `shared/src/ledger/predictive.ts` exposes calibration imports, CSV parsing, and narrative generation so forecasts are explainable with confidence bands. | ✅ Complete |
| Regulatory readiness | `/ato/stp/report` route, DSP tracker, and onboarding artifacts link back to AUSTRAC and OSF questionnaires for an end-to-end audit trail. | ✅ Complete |
| Production readiness | Runbooks + scripts under `scripts/*.ts` automate wizarding, PayTo provisioning, vault sync, pilot seeding, and verification so HA pilots are reproducible. | ✅ Complete |

> Use this matrix as the front page of the regulator submission pack; each row links to a tangible artifact so reviewers can click through and verify the control evidence.
