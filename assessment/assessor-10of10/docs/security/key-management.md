# Key management

Key types (example):
- PII encryption keys
- Token signing keys
- Database at-rest encryption (platform-managed where available)

Lifecycle:
- Generation: via approved mechanism
- Storage: secrets manager (production), never plaintext in repo
- Rotation: scripted (see scripts/rotate-pii-keys.mjs)
- Access: least privilege, break-glass procedure documented
- Decommission: retire old keys after defined overlap window

Break-glass:
- Requires documented approval and is always audited.
