# API Gateway

## Admin authentication

Administrative routes (`/admin/export/:orgId`, `/admin/delete/:orgId`, and `/admin/pii/*`) now require a signed JWT presented via the
`Authorization: Bearer <token>` header. Configure verification with the following environment variables:

| Variable | Description |
| --- | --- |
| `ADMIN_JWT_SECRET` | HMAC secret material used to validate `HS256` signatures. |
| `ADMIN_JWT_ISSUER` | Expected issuer (`iss`) claim. |
| `ADMIN_JWT_AUDIENCE` | Expected audience (`aud`) claim. |
| `ADMIN_JWT_REVOKED_IDS` | Optional comma-separated list of revoked token IDs (`jti`). |
| `ADMIN_JWT_CLOCK_SKEW` | Optional number of seconds to allow for clock skew when evaluating `exp`. |

Tokens must include:

- `roles` array containing `admin` for privileged access.
- `orgs` array listing the permitted organisation IDs (or `*` for global access).
- `exp`, `iss`, `aud`, and `sub` claims.

Requests with missing, expired, revoked, or improperly scoped tokens receive an HTTP 401/403 response.

