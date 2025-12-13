# Access control policy

Scope:
- This policy defines how identities are created, authenticated, authorized, and audited.

Principles:
- Least privilege by default
- Separation of duties for high-risk operations
- Strong authentication for privileged actions (MFA in production)
- Explicit tenant scope enforcement

Controls:
- Roles and permissions are defined in docs/security/authz-matrix.md
- Privileged actions require MFA in production (docs/security/mfa-policy.md)
- Session lifetime, rotation, and revocation requirements are documented in docs/security/session-policy.md
- All auth decisions are logged and correlated to requestId

Review:
- Owner: Security/Compliance
- Review cadence: quarterly
