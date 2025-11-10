# Standard Operating Procedures Evidence

## Oversight and Release SOPs
1. **Model Promotion Checklist**
   - Verify completion of bias, robustness, and privacy evaluations with sign-off from Responsible AI Guild.
   - Ensure model cards, lineage records, and explainability reports are attached to the release record.
   - Confirm rollback plan and on-call ownership are documented before production enablement.
2. **Human-in-the-Loop Review**
   - Weekly oversight reviews analyze drift dashboards and user feedback.
   - Any risk findings trigger the incident management SOP outlined below.

## Incident Management SOP
- **Detection:** SOC and ML observability alerts automatically create tickets in the risk register.
- **Triage:** Legal, security, and engineering duty officers convene within 30 minutes to assess impact.
- **Remediation:** Containment, eradication, and recovery steps are executed per playbook, with evidence logged in the compliance repository.
- **Post-Incident Review:** Findings feed patent changelog updates and roadmap adjustments.

## Documentation Control
- SOP updates require dual approval (security + legal) and are versioned with tags referencing the quarterly review cycles.
- The compliance team audits adherence each quarter and records results in `compliance-metrics.md`.
