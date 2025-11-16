# DSP OSF evidence index

The following index groups the artifacts we rely on when answering the ATO DSP Operational Security Framework (OSF) questionnaire. Each item links back to specific controls in `docs/compliance/dsp-operational-framework.md`.

## Governance & policy
- **Security policy & contacts:** `SECURITY.md` (reporting alias, SLA, disclosure timeline).
- **Runbook ownership:** `docs/runbooks/admin-controls.md`, `docs/runbooks/compliance-monitoring.md`, and `runbooks/ndb.md` show the operational owners referenced in GOV-02, while `docs/security/ASVS-mapping.md` ties those controls back to OWASP ASVS coverage for auditors who map between frameworks.

## Identity & access management
- **MFA enforcement:** Source code (`services/api-gateway/src/auth.ts`, `services/api-gateway/src/routes/auth.ts`, `webapp/src/SecurityPage.tsx`, `webapp/src/BasPage.tsx`, `webapp/src/AlertsPage.tsx`) demonstrates how MFA is required for BAS lodgment, alert resolution, and enrolment.
- **JWT/session integrity:** `services/api-gateway/src/auth.ts` plus environment settings in `docker-compose.yml` prove how issuer/audience/kid values are loaded and validated.

## Logging & monitoring
- **Audit log chain:** `services/api-gateway/src/lib/audit.ts` plus admin routes in `services/api-gateway/src/routes/admin.data.js` cover LOG-01 evidence.
- **Security-event feeds:** `shared/src/security-log.ts` (correlation IDs) and monitoring steps in `docs/runbooks/admin-controls.md`/`docs/runbooks/compliance-monitoring.md` link to LOG-02, with `docs/security/ASVS-mapping.md` documenting the control lineage for the same hooks.

## Crypto & secrets
- **Key rotation script:** `scripts/rotate-pii-keys.mjs` and the `security:rotate-keys` script inside `package.json` document the CR-01 workflow.
- **Secrets lifecycle:** `docs/runbooks/secrets-management.md` contains the operational steps and evidence pack references, and the TFN SOP (`docs/security/TFN-SOP.md`) explains how TFN or PII artefacts are handled before/after rotations.

## Compliance monitoring & incident response
- **Designated account monitoring:** `worker/src/jobs/designated-reconciliation.ts` and `docs/runbooks/compliance-monitoring.md` satisfy MON-01.
- **Incident templates:** `runbooks/ndb.md` is used to show IR-01 evidence (OAIC template, customer notice, retrospective cadence), and the TFN SOP demonstrates how regulator notifications align with OAIC/NDB privacy obligations when TFNs are involved.

## Submission tracker
- `docs/dsp-osf/questionnaire.md` stores the draft questionnaire answers.
- `status/dsp-osf.md` records the submission ID, reviewer, and current certification state.
- Evidence packs, screenshots, and regulator correspondence must be exported to `artifacts/compliance/osf/` with filenames that include the submission date (e.g., `questionnaire-2025-11-16.pdf`).

## Open remediation items
- LOG-02 SIEM export and INF-01 AU residency proof remain open (see the control matrix). Update this file with dashboard URLs and hosting attestations once those deliverables land.
