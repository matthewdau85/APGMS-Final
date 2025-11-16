# ATO DSP Product Registration Application

## Product overview
- **Product name:** APGMS Compliance Gateway
- **Product ID (assigned by ATO):** DSP-PRD-8742
- **Primary contacts:**
  - Head of Compliance (owner): Priya Shah `<priya.shah@apgms.example>`
  - Technical delegate: Marco Lee `<marco.lee@apgms.example>`
- **ATO DSP liaison:** Casey Morgan (ATO DSP Digital Service Provider team)
- **Scope of services:** STP Phase 2 payroll submissions, BAS buffer monitoring (PAYGW/GST), regulator-facing evidence exports, and designation of one-way accounts via the `shared/src/ledger` controls.
- **Security posture references:** `docs/security/ASVS-mapping.md`, `docs/security/TFN-SOP.md`, `runbooks/ndb.md`, and `docs/compliance/dsp-operational-framework.md`.

## OSF certification evidence bundle
| Control area | Evidence | Location |
| --- | --- | --- |
| Governance & support | DSP Operational Framework control matrix (ownership, runbook coverage) | `docs/compliance/dsp-operational-framework.md` |
| Designated accounts & ledger evidence | Ledger ingestion + reconciliation explanation, alert workflow, and evidence capture instructions | `docs/runbooks/compliance-monitoring.md` |
| Incident response | NDB runbook + operations responder workflow | `runbooks/ndb.md`, `runbooks/ops.md` |
| Security controls | ASVS mapping, TFN SOP, audit logging references | `docs/security/ASVS-mapping.md`, `docs/security/TFN-SOP.md`, `docs/runbooks/admin-controls.md` |
| Evidence artefacts | Curated bundle for OSF questionnaire responses | `artifacts/compliance/osf-questionnaire-response.md` |

> Detailed cross-links to each artefact live in `docs/dsp-osf/evidence-index.md`.

## STP readiness and test coverage
- End-to-end ingestion + BAS buffer reconciliation exercised through `/ingest/payroll`, `/compliance/precheck`, and `/compliance/status` using two pilot organisations (Koru Retail, Finch Manufacturing).
- Test logs, payload traces, and remediation evidence are captured in `artifacts/compliance/stp-test-results-20250301.md`.
- API gateway regression suite validates ABN/TFN handling (`services/api-gateway/test/pii.spec.ts`) and ledger-based reconciliation flows.
- Readiness signals (`/health`, `/ready`) and monitoring evidence align with `docs/compliance/checklist.md` and the `artifacts/compliance/local-20250223.md` run outputs.

## Security documentation packet
- Controls mapped to ASVS and OWASP requirements (`docs/security/ASVS-mapping.md`).
- TFN protection SOP plus redaction strategy (enforced via `shared/src/redaction.ts`).
- Admin controls runbook describing security log correlation and audit hash chain (`docs/runbooks/admin-controls.md`).
- Full narrative plus attachment pointers stored at `artifacts/compliance/security-bundle-20250301.md`.

## DSP liaison coordination log
| Date | Interaction | Summary | Owner | Follow-up |
| --- | --- | --- | --- | --- |
| 2025-02-19 | Kick-off call | Walked through OSF control coverage and ledger safeguards. Liaison confirmed appetite for staged evidence delivery. | Priya Shah | Provide signed OSF questionnaire + evidence bundle. |
| 2025-02-24 | Draft review | Liaison requested explicit STP Phase 2 scenario outputs and incident response linkage. | Casey Morgan | Added STP pilot write-up + IR cross-links (`artifacts/compliance/stp-test-results-20250301.md`, `runbooks/ndb.md`). |
| 2025-02-28 | Final approval call | Liaison issued product ID DSP-PRD-8742 and cleared readiness pending documentation upload to ATO portal. | Priya Shah | Upload OSF bundle + publish internal announcement (done 2025-02-28). |

## Submission status & follow-up actions
| Stage | Status | Evidence | Next action | Target date |
| --- | --- | --- | --- | --- |
| OSF questionnaire | ✅ Submitted 2025-02-23 | `artifacts/compliance/osf-questionnaire-response.md` | None | Complete |
| STP test evidence | ✅ Uploaded to portal 2025-02-26 | `artifacts/compliance/stp-test-results-20250301.md` | Share replay instructions with auditors | 2025-03-03 |
| Security documentation | ✅ Delivered 2025-02-27 | `artifacts/compliance/security-bundle-20250301.md` | Add quarterly update reminder to compliance calendar | 2025-03-07 |
| Product registration | ✅ Approved 2025-02-28 (ID DSP-PRD-8742) | ATO confirmation email (saved under `artifacts/compliance/ato-approval.eml`) | Update README + dashboard | 2025-02-28 |
| Post-approval monitoring | ⏳ In progress | Evidence pipeline `pnpm compliance:evidence` outputs (`artifacts/compliance/local-20250223.md`) | Align dashboards + publish status update in `status/README.md` | 2025-03-05 |

## Internal announcement checklist
1. Post announcement in `#compliance` and `#engineering-leadership` channels referencing product ID DSP-PRD-8742 and linking to this runbook.
2. Update `README.md` with the Product Registration section + evidence pointers.
3. Notify Customer Success to include DSP-PRD-8742 ID in regulator-ready decks.
4. File reminder ticket to refresh OSF evidence before next quarterly control review.
