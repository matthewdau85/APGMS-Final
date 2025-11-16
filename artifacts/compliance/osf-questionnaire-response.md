# OSF Questionnaire Responses (Submitted 2025-02-23)

## Product metadata
- Product: APGMS Compliance Gateway (DSP-PRD-8742)
- Version: 1.0 (ledger + compliance dashboard release)
- Hosting: Dedicated AU region deployment (per infra IaC; see `infra/README.md`).
- Contacts: Priya Shah (compliance), Marco Lee (technical), Casey Morgan (ATO liaison).

## Governance & support
1. **Executive sponsorship** – COO acts as accountable executive; charter recorded in `docs/runbooks/stakeholder-connect.md`.
2. **Incident SLAs** – 24h regulator notification commitment covered in `runbooks/ndb.md` (section 4) and mirrored on `status/README.md`.
3. **Support process** – Customer Success runbook ensures regulator requests route through `status/` announcements.

## Security & assurance
1. **Authentication and MFA** – Admin portal enforces WebAuthn/TOTP (see `docs/compliance/dsp-operational-framework.md` table row "MFA for privileged access").
2. **Audit logging** – `docs/runbooks/admin-controls.md` outlines immutable audit hash chain + `secLog` correlation IDs.
3. **TFN handling** – `docs/security/TFN-SOP.md` plus enforcement inside `shared/src/redaction.ts` and API gateway tests.
4. **Penetration testing** – Annual pen test requirement documented inside the DSP Operational Framework; next window booked for Q2 FY25.

## Operational integrity
1. **Designated accounts** – Buffer coverage logic and alerting described within `docs/runbooks/compliance-monitoring.md` and supported by worker job `worker/src/jobs/designated-reconciliation.ts`.
2. **Monitoring evidence** – `artifacts/compliance/local-20250223.md` includes regression + readiness evidence captured with `pnpm compliance:evidence`.
3. **Change management** – Release checklist stored at `docs/compliance/checklist.md` and linked from `README.md`.

## STP/BAS readiness
1. **Data ingestion** – `shared/src/ledger/ingest.ts` handles payroll/POS submissions with idempotency guards; ingestion instructions captured in the compliance monitoring runbook.
2. **Pre-lodgment checks** – `/compliance/precheck` logic ensures BAS buffer sufficiency; referenced in runbook Phase 2 section.
3. **Evidence** – STP pilot details recorded under `artifacts/compliance/stp-test-results-20250301.md` and cross-referenced inside the application runbook.

## Attachments uploaded to ATO portal
- PDF export of this file.
- Supporting ZIP containing:
  - `docs/compliance/dsp-operational-framework.md`
  - `docs/security/ASVS-mapping.md`
  - `docs/security/TFN-SOP.md`
  - `docs/runbooks/admin-controls.md`
  - `docs/runbooks/compliance-monitoring.md`
  - `artifacts/compliance/local-20250223.md`
