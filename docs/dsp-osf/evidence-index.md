# DSP OSF evidence index

## Evidence map
| Area | Artifact | Location |
| --- | --- | --- |
| OSF questionnaire responses | Consolidated answers with control references | `artifacts/compliance/osf-questionnaire-response.md` |
| STP Phase 2 test evidence | Pilot scenarios, payload traces, remediation notes | `artifacts/compliance/stp-test-results-20250301.md` |
| Security documentation bundle | ASVS mapping, TFN SOP, incident + audit guidance | `artifacts/compliance/security-bundle-20250301.md` |
| Ledger/compliance runbooks | Compliance monitoring + admin controls references | `docs/runbooks/compliance-monitoring.md`, `docs/runbooks/admin-controls.md` |
| Incident response | NDB and ops runbooks | `runbooks/ndb.md`, `runbooks/ops.md` |
| Product registration status | ATO DSP submission log, liaison notes | `runbooks/compliance/ato-dsp-registration.md` |

## How to use this index
1. Start with the OSF questionnaire response file, which mirrors the portal prompts and links back to the relevant controls inside `docs/compliance/dsp-operational-framework.md`.
2. When auditors request proof of STP readiness, share the STP Phase 2 test evidence file plus the automated evidence bundle at `artifacts/compliance/local-20250223.md`.
3. Link the security documentation bundle to demonstrate TFN handling, ASVS coverage, and audit log immutability. Cross-reference `shared/src/redaction.ts` for TFN masking and `docs/runbooks/admin-controls.md` for tamper-resistance explanations.
4. For status questions (e.g., "what is your product ID?"), point reviewers to the product registration runbook, which tracks liaison feedback, approvals, and follow-up actions.
5. Store additional supporting material (emails, signed PDFs) under `artifacts/compliance/` and append their relative paths to this file so the index stays current.
