# Security Policy

Email: security@yourdomain.example

## End-to-End Encryption Requirements
- Enforce TLS 1.2+ for all external and internal service-to-service traffic, with perfect forward secrecy cipher suites.
- Require envelope encryption for data at rest using AES-256 GCM keys stored in the managed HSM, and client-side encryption for highly sensitive exports.
- Maintain automated certificate management with renewal alarms at 30/15/7-day thresholds.

## Multi-Factor Authentication Coverage
- Mandate phishing-resistant MFA (WebAuthn or FIDO2) for all workforce identities, including contractors and support vendors.
- Require step-up MFA for privileged actions (production deploys, key access, break-glass sessions).
- Integrate federated identity providers with conditional access policies enforcing device posture checks.

## Key-Rotation Cadence
- Rotate customer data encryption keys at least every 90 days or immediately upon suspected compromise.
- Rotate service account credentials every 60 days, with automated revocation workflows for stale keys.
- Document key provenance and rotation events in the central secrets inventory with attestation by the security operations lead.

## Penetration-Test Expectations
- Commission independent penetration tests at least annually and after significant architectural changes.
- Track remediation for all critical/high findings within 30 days and medium findings within 90 days.
- Provide executive summaries and detailed reports to compliance and risk stakeholders, with sign-off recorded in the GRC platform.

## Forensic Logging Standards (ATO DSP Alignment)
- Collect tamper-evident logs for authentication events, administrative actions, data exports, and privileged API calls.
- Retain forensic logs for a minimum of 12 months in immutable storage with access restricted to the security operations team.
- Synchronise system clocks via secure NTP and document log review procedures meeting ATO DSP evidence requirements.
