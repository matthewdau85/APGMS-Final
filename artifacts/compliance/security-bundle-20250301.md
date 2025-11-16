# Security Documentation Bundle (2025-02-27 Delivery)

## Contents
1. `docs/security/ASVS-mapping.md` – Maps API gateway, webapp, and worker controls against OWASP ASVS L2 requirements.
2. `docs/security/TFN-SOP.md` – TFN lifecycle, masking procedure, and emergency rotation SOP.
3. `docs/runbooks/admin-controls.md` – Security log + audit log correlation runbook.
4. `runbooks/ndb.md` & `runbooks/ops.md` – Incident escalation procedures, communication templates, and regulator notification steps.
5. `docs/compliance/dsp-operational-framework.md` – Control matrix summarising DSP Operational Framework alignment.
6. `artifacts/compliance/local-20250223.md` – Latest automated evidence bundle demonstrating CI parity, SCA, SBOM, and readiness probes.

## Highlights shared with ATO DSP liaison
- **Audit immutability:** hash chaining described in `docs/runbooks/admin-controls.md` plus implementation references in `shared/src/logging.ts` and `services/api-gateway/src/routes/admin.data.js`.
- **Access controls:** WebAuthn/TOTP enforcement for admin actions, rate limits (`API_RATE_LIMIT_MAX`), and correlation IDs.
- **Secret handling:** Reference to `docs/runbooks/secrets-management.md` (in docs/runbooks) showing KMS rotation + `.env` guardrails.
- **Privacy protections:** TFN SOP + ABN validation tests (see `services/api-gateway/test/pii.spec.ts`).
- **Monitoring:** `status/README.md` guidance + `docs/compliance/checklist.md` ensures each release captures regulator-facing evidence.

## Delivery notes
- Bundle exported as `security-bundle-20250227.zip` and attached to the ATO DSP portal submission.
- Hash recorded in compliance ticket COMP-411 (`sha256: b120a9f5ad20d4606f24f90a7872aa6c605d355fbf8d1a06bd5f02a726f8e6c7`).
- Future updates: refresh ASVS mapping whenever new scope (e.g., BFS integration) lands; add pen test report once Q2 FY25 engagement completes.
