# DSP OSF readiness tracker

| Milestone | Owner | Target date | Status | Notes |
| --- | --- | --- | --- | --- |
| Refresh control matrix & evidence index | Security | 2025-11-16 | ✅ Done | `docs/compliance/dsp-operational-framework.md` + `docs/dsp-osf/evidence-index.md` updated with GOV/IAM/LOG/CR/MON/IR coverage. |
| Draft DSP OSF questionnaire responses | Security/Compliance | 2025-11-16 | ✅ Done | `docs/dsp-osf/questionnaire.md` filled using `SECURITY.md`, runbooks, and deployment configs. |
| Submit questionnaire & evidence pack to compliance mailing list | Compliance | 2025-11-17 | 🔄 In progress | Export PDF + supporting logs to `artifacts/compliance/osf/questionnaire-2025-11-16.pdf`, then email compliance@ with submission ID and attach to Confluence ticket. |
| Wire SIEM forwarding for `security_event` + Prometheus metrics | Ops | 2025-12-15 | ⚠️ Open | Deploy Fluent Bit/OpenTelemetry collector to ship Fastify logs + metrics to the managed SIEM; document dashboard URL back in `docs/dsp-osf/evidence-index.md`. |
| Capture AU region attestation for production hosting | Compliance/Ops | 2026-03-31 | ⚠️ Open | Update IaC with the selected AU region/provider and attach signed attestation or cloud agreement excerpt. |

## Submission log
| Date | Submission ID | Scope | Reviewer | Next action |
| --- | --- | --- | --- | --- |
| 2025-11-16 | DSP-OSF-2025-11 | Control matrix refresh + questionnaire draft | Security Lead | Export PDF + share with compliance@ before 2025-11-17 COB |

## Coordination notes
- Evidence packs live under `artifacts/compliance/osf/`. Keep the folder synced to the secure document vault whenever a new submission ships.
- Compliance team updates this tracker once the ATO acknowledges receipt or requests clarification; capture email subject lines + case numbers here.
- When Ops closes the SIEM or hosting attestation gaps, link the change tickets and dashboards in the milestone notes so future auditors can navigate directly.
