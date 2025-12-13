# Environments

Minimum environments:
- dev (local)
- staging (pre-prod)
- production

Rules:
- No production data in dev or staging unless explicitly approved and sanitized.
- Secrets are managed per environment.
- Data residency requirements are enforced in production deployment configuration.
