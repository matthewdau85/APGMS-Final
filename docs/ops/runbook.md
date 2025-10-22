# Ops runbook

## GitHub Actions configuration

### Required secrets and variables
Set these values once at the repository level (or organisation level if shared across multiple repos) before enabling any workflow that depends on them.

| Name            | Type    | Purpose |
| --------------- | ------- | ------- |
| `ADMIN_TOKEN`   | Secret  | Token used by administrative workflows that need elevated privileges, such as managing feature flags or triggering protected deployments. |
| `API_KEY`       | Secret  | Temporary API credential consumed by integration smoke tests. Rotate on expiry and remove when longer-term credentials are available. |
| `AUTH_JWKS_URL` | Variable | JWKS endpoint used by authentication checks in CI smoke tests. |
| `AUTH_AUDIENCE` | Variable | Expected audience claim enforced in authentication validation jobs. |
| `AUTH_ISSUER`   | Variable | Issuer claim required by authentication validation jobs. |
| `CORS_ALLOWLIST`| Variable | Comma-separated list of origins that workflows use when validating CORS headers. |

> ℹ️ Secrets should be added under **Settings → Secrets and variables → Actions → Repository secrets**. Variables belong in the **Variables** tab of the same screen.
