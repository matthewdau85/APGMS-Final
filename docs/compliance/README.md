# Compliance documentation index

The compliance directory centralises the artefacts required to demonstrate APGMS' level-five
compliance posture. Documents here complement customer-facing collateral and internal
runbooks by providing the detailed playbooks, scorecards, and assessments that auditors and
partners expect during diligence. Each document is maintained according to the cadence listed
below and links back to supporting evidence in the `artifacts/` tree or other repositories.

## Quick links

| Document | Purpose | Owner | Cadence |
| --- | --- | --- | --- |
| [`readiness-program.md`](readiness-program.md) | Operating model, governance cadence, and automation coverage. | Compliance Ops Lead | Semi-annual review or after major regulatory change. |
| [`maturity-model.md`](maturity-model.md) | Capability matrix and assessment method defining level criteria. | Compliance Ops Lead | Quarterly to align with steering committee reviews. |
| [`scorecard.md`](scorecard.md) | Executive snapshot of control performance with reproducible queries. | Compliance Ops Analyst | Monthly on the first business day. |
| [`../dsp-osf/evidence-index.md`](../dsp-osf/evidence-index.md) | Mapping of DSP OSF controls to evidence locations. | Compliance Ops Lead | Monthly sweep plus on-demand updates. |

## Evidence handling

- Rendered scorecard PDFs and maturity assessments are archived under
  `artifacts/compliance/` with immutable timestamps and signatures captured in the GRC vault.
- Accessibility audit exports referenced by the scorecard and accessibility statement live in
  `artifacts/a11y/` with retention documented in each subfolder.
- KMS rotation logs and other security attestations remain in `artifacts/kms/` and are linked
  directly from security SOPs and the DSP OSF evidence index.

## Update workflow

1. Draft changes in this repository and obtain review from the Compliance Ops Lead and the
   relevant control owner.
2. Update artefact placeholders or upload evidence files to the vault, recording paths in the
   appropriate README so auditors can trace references.
3. Capture version history updates inside each document, mirroring the effective date in the
   compliance scorecard when applicable.
4. After merging updates, tag the change log in the risk register and include highlights in the
   next Compliance Steering Committee agenda.

## Version history

| Version | Date | Owner | Notes |
| --- | --- | --- | --- |
| 1.0 | 2024-11-01 | Compliance Ops Lead | Added index to consolidate compliance documentation links. |
