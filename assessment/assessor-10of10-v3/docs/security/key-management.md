# Key Management

## Scope
- Application secrets
- Encryption keys
- Signing keys

## Principles
- Separate keys per environment
- Rotate keys on schedule and on incident
- Store keys in managed secret store (KMS/HSM where possible)

## Operational requirements
- Key access is least privilege
- Key usage is logged
- Backups of key material are handled per secret store features (avoid exporting keys)
