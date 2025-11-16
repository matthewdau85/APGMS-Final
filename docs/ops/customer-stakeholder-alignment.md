# Customer & Stakeholder Alignment Plan

## Overview
This document captures the discovery work completed with pilot customers, accounting partners, and regulator stakeholders during October–November 2025. Interviews were completed over Zoom with structured question sets aligned to the onboarding, mandate management, and compliance reporting journeys. Feedback below is anonymised but traceable to CRM notes `CS-1054` through `CS-1056`.

## Stakeholder Survey Summary
| Stakeholder | Role | Biggest pain point | Requested capabilities | Notes |
| --- | --- | --- | --- | --- |
| **Bluegum Advisory** | Boutique SME accounting firm supporting 18 shared clients | Missing ABN validation and onboarding guidance leads to 3× back-and-forth emails per client. | Guided onboarding wizard with inline validation, live ABN/TFN checks, ability to upload director IDs. | Willing to beta test wizard revamp in Sprint 25 once validation API is online.
| **Urban Bloom Pty Ltd** | Retail SME pilot customer | Lacks visibility on PayTo mandate status and does not receive alerts before BAS shortfalls occur. | Push/email notifications for mandate lifecycle, shortfalls, and BAS reminders; dashboard indicators for forecast risk. | Requests notifications in-app plus email summary; acceptable to bundle with weekly digest.
| **ATO Digital Relationship Lead** | Regulator observer | Needs assurance that TFN/ABN data is handled per DSP OSF controls and that compliance evidence is exportable on demand. | OSF security questionnaire, data sovereignty runbook, and compliance export bundle accessible via regulator portal. | Flagged requirement to document RPO/RTO and evidence of TFN masking in logs before next demo.

## Prioritised Feature Backlog
| Item | Description | Priority | Sprint Target | Dependencies |
| --- | --- | --- | --- | --- |
| **C2-Onboard-UX** | Rebuild onboarding wizard with Material UI, progress indicator, contextual tooltips, and ABN/account validations. | P0 | Sprint 25 | Live ABR integration (A1), updated UX copy from Legal.
| **C3-Notify-Shortfall** | Event-based notifications for mandate status, shortfalls, BAS reminders, and forecast risk thresholds. | P0 | Sprint 26 | Event bus instrumentation, comms template approvals.
| **A1-ABR-Integration** | Replace stubbed validation with ABR Lookup + TFN masking pipeline. | P0 | Sprint 24 | Secrets vault credentials, audit logging updates.
| **A2-OSF-Package** | Complete DSP OSF questionnaire plus evidence pack (pen test, encryption policies, supply chain). | P1 | Sprint 24 | Security review sign-off, docs/compliance updates.
| **P2-Compliance-Export** | Generate regulator-ready ZIP bundles (audit logs, STP XML, BAS summaries). Surface via `/compliance/export`. | P1 | Sprint 27 | STP v2 generator (A3), regulator portal enhancements (P4).
| **P3-Role-Based-Scopes** | Enforce scoped tokens for admins/accountants/regulators and hide unauthorised UI sections. | P1 | Sprint 26 | Auth service upgrade (services/auth v3), design sign-off.
| **L2-Secrets-Vault** | Migrate API keys/JWT secrets to managed vault with rotation runbook. | P2 | Sprint 24 | Platform infra support, regression testing.
| **L4-Data-Retention** | Document and automate data retention schedules for financial, audit, and personal data. | P2 | Sprint 27 | Job orchestration (Temporal) and legal review.

## Sprint Mapping & Outcomes
- **Sprint 24 (Nov 3–14)**: Focus on compliance foundations (A1, A2, L2) so onboarding and notification work can rely on production-grade controls.
- **Sprint 25 (Nov 17–28)**: Deliver the enhanced onboarding UX (C2-Onboard-UX) with beta testers Bluegum Advisory + 3 SMEs.
- **Sprint 26 (Dec 1–12)**: Complete notification service (C3-Notify-Shortfall) and role-based scopes (P3) to unblock regulator portal updates.
- **Sprint 27 (Jan 5–16)**: Ship compliance export bundle (P2), regulator portal filters (P4), and data retention automation (L4).

## Next Steps
1. Circulate this backlog during the weekly steering committee (agenda item already slotted for 6 Nov).
2. Convert each backlog item into Linear issues (`PLAT-421` through `PLAT-428`) with acceptance criteria matching this document.
3. Track onboarding UX beta completion rate; target >90% completion across 15 pilot customers to exit beta.
