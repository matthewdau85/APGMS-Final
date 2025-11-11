# Vendor and Data-Sharing Governance Register

Maintain visibility into third-party vendors, data-sharing agreements, and the
health of supporting integrations.

## Register
| Vendor / Partner | Service Scope | Data Shared | Renewal Date | Reminder Lead Time | Breach Contact | Integration Health KPIs | Notes |
| ---------------- | ------------- | ----------- | ------------ | ------------------ | -------------- | ----------------------- | ----- |
| Acme KYC Services | Identity verification API | PII (name, DOB, document images) | 2025-06-30 | 60 days | security@acmekyc.example | SLA uptime >99.9%, verification latency <2s | Quarterly privacy review aligned to fairness audit. |
| Sentinel Fraud Analytics | Fraud scoring ML | Transaction metadata, device fingerprints | 2025-08-15 | 90 days | soc@sentinelfraud.example | Score coverage >98%, drift alerts resolved <48h | Requires joint review before model threshold updates. |
| RegGov Secure Exchange | Regulator document portal | Compliance evidence bundles, audit logs | 2025-11-01 | 45 days | trust@reggov.example | Upload success rate 100%, handshake latency <1s | Share DSP evidence refresh confirmation quarterly. |

## Governance Actions
- Calendar reminders generated automatically from renewal dates with specified
  lead times.
- Breach notification drills executed annually; confirm contact addresses and
  communication trees.
- Integration KPIs reviewed monthly with operations to pre-empt degradation.
- Record remediation tasks in the compliance tracker and reference in
  `status/roadmap.md` when audits rely on vendor attestations.
