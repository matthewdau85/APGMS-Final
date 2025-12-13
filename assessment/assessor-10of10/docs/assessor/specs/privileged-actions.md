# Privileged actions spec

Privileged actions include:
- creating/deleting orgs
- issuing/revoking credentials
- changing encryption keys
- changing retention policies
- modifying settlement gates and compliance settings
- exporting regulator evidence packs

For each privileged action:
- require MFA (production)
- require least-privileged role
- write an audit event with requestId/correlationId
- produce evidence artifact (where applicable)

Evidence targets:
- docs/security/mfa-policy.md
- docs/security/authz-matrix.md
- tests that assert audit event presence for privileged actions
