# OWASP ASVS Level 2 control mapping

This document links APGMS application security controls to the OWASP Application
Security Verification Standard (ASVS) Level 2 requirements.

| ASVS section | Requirement summary | APGMS control | Evidence | Status | Next action |
| --- | --- | --- | --- | --- | --- |
| V1 Architecture | Documented architecture and threat models | `docs/architecture/README.md`, quarterly threat modelling workshops | Threat model deck Q3 2024 | ✅ In control | Publish additive threat model for compliance drift analytics (Architecture, 2024-11-15) |
| V2 Authentication | Enforce MFA and secure password storage | Cognito with MFA, bcrypt password hashing, lockout policy | IAM configuration export, security test results | ✅ In control | Complete backup authenticator rollout briefing (Security Eng, 2024-11-05) |
| V3 Session management | Session expiration and revocation | JWT access tokens with 60-minute TTL, device-bound refresh tokens with proof-of-possession | API Gateway configuration, automated tests, RFC-218 completion memo | ✅ In control | Monitor telemetry for anomalous refresh attempts (Security Eng, continuous) |
| V5 Validation, sanitisation & encoding | Centralised input validation and output encoding | Shared Zod schema library, React encoding helpers | Static analysis report, unit tests | ✅ In control | Roll out schema coverage to new partner import CLI (App Platform, sprint 2024-45) |
| V4 Access control | Authorisation on every request | Role-based access in API Gateway, route guards in SPA | Playwright auth tests, code review checklist | ✅ In control | Add regression test for new portfolio export scope (QA, sprint 2024-44) |
| V6 Cryptography | Secure key management | AWS KMS, key rotation procedure (`artifacts/kms/rotation.md`) | KMS rotation logs | ✅ In control | Upload HSM attestation to vault (Compliance Ops, completed 2024-10-26) |
| V7 Error handling | No sensitive data in error responses | Centralised Fastify error mapper, Sentry scrubbing rules | Sentry redaction tests, code review checklist | ✅ In control | Add chaos test to verify redaction when upstream service fails (Reliability, 2024-11-05) |
| V8 Data protection at rest | Hardening for stored secrets and backups | Encrypted RDS snapshots, secret rotation automation | Backup restore test log, rotation tickets | ✅ In control | Document quarterly restore validation evidence in vault (Infra, completed 2024-10-28) |
| V9 Communications | Secure transport layer configuration | TLS 1.3 edge termination, strict cipher suite policy | SSL Labs scan, AWS ACM config | ✅ In control | OCSP stapling synthetic monitors active; review results weekly (Security Eng, continuous) |
| V10 Data protection | Sensitive data at rest/in transit | TLS 1.2+, PostgreSQL encryption, TFN SOP controls | `docs/security/TFN-SOP.md`, penetration test report | ✅ In control | Validate masking coverage in new evidence export worker (Security Eng, 2024-11-08) |
| V11 API security | Input validation and rate limiting | Zod schemas in API Gateway, rate limits via Fastify plugins with telemetry | Unit tests, Fastify config, Grafana dashboard snapshot | ✅ In control | Tune adaptive rate-limit thresholds based on analytics (Platform, 2024-11-12) |
| V12 File handling | Validate and store uploads securely | ClamAV scanning lambda, signed URL uploads, content-type enforcement | Virus scan logs, S3 bucket policy | ✅ In control | Review exception for legacy onboarding PDF (Security Eng, 2024-11-12) |
| V13 Data at rest | Database and storage protection | Read replica encryption, row-level security policies | Terraform state, security review minutes | ✅ In control | Implement automated RLS policy drift detection (Database Guild, 2024-11-19) |
| V14 Configuration | Secure default configuration | Terraform baseline, immutable container images | CI pipeline logs, Terraform plan approvals | ✅ In control | Document drift detection runbook (Platform, 2024-11-20) |

## Maintenance

Security engineering reviews this mapping quarterly and after major product launches. During
each review, control owners update the status/next action columns and verify evidence freshness
in the compliance vault. Review minutes are stored in Confluence `Security-ASVS-QBR`.
Telemetry from the compliance scorecard flags overdue next actions, and Jira automation prevents
closing related tickets until the evidence column links to a current artefact.

