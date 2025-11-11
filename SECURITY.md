# Security Policy

Email: security@yourdomain.example

## Multi-Factor Authentication Scope
- MFA is mandatory for all workforce identities accessing production systems, source control, CI/CD, and administrative SaaS platforms.
- Privileged service accounts must leverage phishing-resistant factors (WebAuthn or hardware OTP) managed through Okta.
- Exceptions require CISO approval and must be revalidated every 30 days.

## TLS & Encryption Standards
- Enforce TLS 1.2+ for all external services and TLS 1.3 for internal mesh communications.
- Use AES-256-GCM for data at rest via cloud-managed KMS; rotating CMKs every 12 months.
- Certificates are issued through ACME automation with 60-day renewal windows.

## Key Rotation Cadence
- Secrets and API keys stored in Vault rotate every 90 days or immediately upon suspected compromise.
- Database credentials rotate automatically via `infra/secrets-operator` with audit logs retained for 3 years.
- Ownership of each key is recorded in `docs/security/key-register.md`.

## Penetration Testing Frequency
- Commission independent penetration tests twice per year covering web, mobile, and API surfaces.
- Trigger ad-hoc testing after major architectural changes or critical vulnerability disclosures.
- Findings are tracked in Jira project `SEC-PENTEST` until remediated and validated by Security Engineering.

## Forensic Logging Requirements (DSP Alignment)
- All production workloads must emit structured logs capturing actor, action, resource, timestamp, and request ID fields.
- Retain forensic logs for a minimum of 18 months in the immutable logging store (`infra/log-archive`) meeting DSP evidence criteria.
- Enable tamper-evident controls (write-once storage, hash chaining) with daily integrity verification.
- Incident Response must be able to export logs within 4 hours to satisfy DSP investigative timelines.
