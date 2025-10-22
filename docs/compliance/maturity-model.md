# Compliance maturity model

This maturity model describes how APGMS evaluates the effectiveness of its compliance
program. Each level builds on the capabilities of the previous one. A domain is considered
complete for a given level when all required artefacts exist, ownership is assigned, and
metrics demonstrate sustained performance for at least two consecutive review cycles.

## Capability matrix

| Level | Description | Required evidence | Automation & tooling | Governance expectations |
| --- | --- | --- | --- | --- |
| 1 – Ad hoc | Compliance work is reactive and undocumented. | Incident notes, ad-hoc emails. | None. | No recurring forums. |
| 2 – Defined | Policies, SOPs, and evidence indexes exist, but tracking is manual. | Current policies, SOPs, static evidence register. | Shared drive and manual reminders. | Quarterly check-ins with control owners. |
| 3 – Integrated | Cross-functional processes and metrics are in place. | Scorecard, risk register, training logs. | Ticketing system, scheduled reviews. | Monthly steering committee with published minutes. |
| 4 – Managed | Metrics drive improvements and gaps trigger automated alerts. | Trend analysis, remediation backlog, automated attestations. | Monitoring jobs for evidence freshness and training SLAs. | Exceptions escalated within the month; customer-facing summaries published. |
| 5 – Optimising | Predictive analytics and benchmarking inform continuous improvements. | Forecast reports, partner-facing transparency pack, documented experiment results. | Predictive drift models, telemetry thresholds, automated control testing. | External benchmarking, quarterly retrospectives with published action trackers. |

## Assessment methodology

1. **Scope definition** – Identify the control families, regulatory obligations, and customer
   commitments in scope for the assessment period.
2. **Evidence collection** – Pull artefacts from the compliance vault, Jira, and the DSP OSF
   index to validate that required documents are current and linked.
3. **Metric verification** – Re-run the SQL queries outlined in `docs/compliance/scorecard.md`
   to validate the reported performance for the period.
4. **Interviews** – Meet with control owners, Customer Success, and Product Accessibility
   representatives to confirm ownership and clarify any pending remediation work.
5. **Scoring** – Apply the capability matrix to each domain (security, privacy, accessibility,
   vendor, training). Domains must satisfy all criteria for the level before they can advance.
6. **Reporting** – Document the consolidated score, deltas from the prior quarter, and agreed
   actions in the monthly steering committee minutes.

## Current state snapshot (November 2024)

- **Security** – Level 5. Continuous control validation runs via IaC guardrails, and predictive
  drift alerts are reviewed weekly.
- **Privacy** – Level 5. DSP OSF evidence, privacy notice diff logs, and consent audits are linked
  directly from the evidence index, with partner-facing transparency reporting enabled.
- **Accessibility** – Level 5. WCAG regression suites run in CI, and guild audits plus research
  insights feed the remediation roadmap and customer communications.
- **Vendor** – Level 4 trending to Level 5. Continuous monitoring is live; the final integration
  for real-time log ingestion is scheduled for mid-November.
- **Training** – Level 5. Automated micro-learning nudges keep completion at 100%, and telemetry
  is exported for partner assurance.

## Review cadence

The maturity assessment is updated quarterly and whenever a major regulatory change occurs. The
Compliance Ops Lead owns the evaluation and captures decisions, evidence links, and follow-up items
in Confluence alongside a PDF export stored in `artifacts/compliance/maturity/`.
