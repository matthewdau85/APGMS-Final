# Session and token policy

Requirements:
- Access tokens: short-lived (e.g., 15-30 minutes)
- Refresh tokens: rotation on use, revocation supported
- Token binding to tenant scope (orgId)
- Revocation and logout must invalidate refresh token and (where possible) access token

Audit:
- token issuance, refresh, and revocation are audited (append-only)
