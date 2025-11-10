# Security Policy

## Contact
- Email: security@yourdomain.example
- PGP: Available on request for sensitive disclosures

## Coordinated Disclosure
We operate a 90-day disclosure window aligned with industry best practice. If you discover a vulnerability, please provide us with:
1. A clear description of the issue and affected components.
2. Steps to reproduce or proof-of-concept code.
3. Impact assessment and any known mitigations.

We will acknowledge submissions within 2 business days, provide status updates at least weekly, and coordinate public disclosure once remediation is complete or the disclosure window expires.

## Security Attestations
- **Cadence**: We publish quarterly attestation reports summarising penetration testing results, control effectiveness reviews, and outstanding risks.
- **Distribution**: Reports are shared with customers under NDA, regulators via the portal, and internal stakeholders through the governance board.
- **Scope**: Attestations cover infrastructure, application security, data governance controls, and key management operations.

## Key Management Commitments
- **Rotation Schedule**: Customer data encryption keys rotate every 90 days; signing and infrastructure keys rotate every 180 days or immediately following any suspected compromise.
- **Custody**: Keys are stored in an HSM-backed KMS with dual control for administrative actions.
- **Auditability**: Every key lifecycle event (generation, rotation, revocation) is logged and mapped to ticketed change records reviewed during attestations.

## Forensic Logging
- **Coverage**: Authentication flows, administrative actions, data export jobs, and regulator portal access are logged with immutable timestamps and checksum validation.
- **Retention**: Forensic logs are retained for a minimum of 18 months in a write-once, read-many (WORM) storage tier.
- **Access**: Retrieval requires joint approval from security and compliance leads, ensuring tamper-proof handling of evidence.

## Incident Response
For suspected or confirmed security incidents, activate the [NDB Runbook](runbooks/ndb.md). Preserve forensic artifacts before making system changes and notify security@yourdomain.example immediately.
