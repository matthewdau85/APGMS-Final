# MFA policy (production)

MFA is mandatory for:
- privileged actions (see docs/assessor/specs/privileged-actions.md)
- admin console access
- regulator export and evidence pack generation
- key rotation and secrets management changes

Acceptable MFA methods:
- FIDO2/WebAuthn (preferred)
- TOTP (acceptable)
- SMS is NOT acceptable for privileged actions (unless risk-accepted exception is documented)

Evidence:
- Implementation notes and acceptance tests must exist for MFA enforcement.
