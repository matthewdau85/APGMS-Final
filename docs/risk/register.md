# Risk register

| ID | Risk description | Likelihood | Impact | Inherent rating | Controls | Control effectiveness | Residual rating | Trend | Owner | Review cadence | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-01 | Unauthorised access to TFN data due to credential compromise | Medium | High | High | TFN SOP, MFA enforcement, quarterly access reviews, continuous session analytics | Effective | Low | ↘ Decreasing | Security Engineering Lead | Quarterly | Validate new OPA deployment policies and rotate privileged credentials (SEC-441, due 2024-11-05) |
| R-02 | Accessibility regression blocking key workflows | Medium | Medium | Medium | Automated axe-core tests, Pa11y CI, manual a11y audits, design checklist | Effective | Low | ↘ Decreasing | Product Design Manager | Monthly | Complete toast accessibility fix and dark mode regression automation (A11Y-342/A11Y-361, sprint 2024-45) |
| R-03 | Incomplete regulator evidence during DSP OSF assessment | Low | High | Medium | Evidence index, compliance vault, monthly sweeps, predictive drift forecasts | Effective | Low | ↘ Decreasing | Compliance Ops Lead | Monthly | Maintain zero ⚠️ status via automated attestations (COMP-96 continuous) |
| R-04 | Bank partner integration delays causing revenue slippage | Medium | Medium | Medium | Bank partner enablement packet, integration checklist, status reviews, sandbox automation | Effective | Low | ↘ Decreasing | Head of Partnerships | Monthly | Launch proactive sandbox health dashboard (GTMS-112, due 2024-11-08) |
| R-05 | Terraform misconfiguration leading to downtime | Low | High | Medium | CI/CD validation, peer review, blue/green deployments, policy-as-code checks | Effective | Low | ↔ Stable | Platform Engineering Manager | Quarterly | Publish drift detection runbook referenced in ASVS table (PLAT-209, due 2024-11-15) |
| R-06 | Compliance training lapses for control owners | Medium | Medium | Medium | LMS tracking, compliance scorecard, micro-learning nudges, steering committee escalations | Effective | Low | ↘ Decreasing | PeopleOps | Monthly | Monitor automation effectiveness and expand to new managers (PEOPLE-107, due 2024-11-12) |
| R-07 | Critical vendor fails to meet compliance obligations | Medium | High | High | Vendor due diligence program, SIG responses, contractual audit rights, continuous monitoring feed | Effective | Medium | ↘ Decreasing | Vendor Risk Manager | Monthly | Complete LLM provider real-time log integration (VRM-133, due 2024-11-15) |
| R-08 | Automated control monitoring gaps lead to stale evidence | Low | Medium | Medium | Worker evidence sweeps, ServiceNow reminders, manual spot checks, predictive alerts | Effective | Low | ↘ Decreasing | Compliance Ops Lead | Monthly | Roll out telemetry to customer assurance portal downloads (COMP-101, due 2024-11-20) |

## Review process

1. Owners update risk likelihood/impact and trend notes ahead of the governance meeting.
2. Compliance Ops compiles action items and escalations for the executive steering committee.
3. Closed risks remain in the register with a "retired" tag for audit traceability.
4. Outstanding next actions are reviewed weekly in the compliance scorecard sync.

