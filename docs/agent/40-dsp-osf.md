# DSP / OSF Evidence Guidance (Grounded)

Authoritative repo docs (preferred sources):
- docs/compliance/dsp-operational-framework.md
- docs/compliance/dsp-osf-evidence-index.md

Evidence pack workflow (must stay operational):
- pnpm compliance:evidence
- pnpm backup:evidence-pack
- pnpm readiness:all

Rule:
- If you add/modify a control, log, audit artefact, security mechanism, or runbook:
  - Update docs/compliance/dsp-operational-framework.md if the control matrix changes.
  - Update docs/compliance/dsp-osf-evidence-index.md to link evidence (code/tests/scripts/runbooks).
  - Ensure the evidence pack commands still run and capture outputs.

If you implement anything mapped to requirements like MFA, logging, auditability, reconciliation artefacts, or security scanning,
you must also ensure the DSP/OSF evidence index references it.
