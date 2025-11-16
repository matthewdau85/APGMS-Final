# Error Taxonomy

The error catalog provides a single source of truth for machine-readable error codes across the APGMS platform. Each entry defines a canonical code, owning domain, HTTP status, severity, retryability flag and remediation text. Use the `catalogError` helper from `@apgms/shared` instead of ad-hoc `AppError` instances so operators, clients and auditors receive consistent responses.

| Code | Domain | HTTP Status | Severity | Retryable | Description | Remediation |
| --- | --- | --- | --- | --- | --- | --- |
| `auth.invalid_body` | auth | 400 | error | false | The request body failed validation. | Double-check required fields and schema definitions before retrying. |
| `auth.missing_user_context` | auth | 401 | warning | true | Authentication context is missing or expired. | Prompt the user to sign in again to refresh their session. |
| `auth.mfa.totp.enrollment_missing` | auth | 409 | warning | false | TOTP enrollment has not been started for this user. | Restart the enrollment flow from `/auth/mfa/totp/begin`. |
| `auth.mfa.totp.invalid_token` | auth | 401 | warning | true | The submitted TOTP code is invalid or expired. | Ask the user to regenerate a TOTP code and re-enter it. |
| `auth.mfa.passkey.registration_missing_response` | auth | 400 | error | false | WebAuthn registration response is required. | Send the client-collected response from `navigator.credentials.create()`. |
| `auth.mfa.passkey.registration_failed` | auth | 401 | error | true | Passkey registration could not be verified. | Retry the registration ceremony and ensure attestation data is intact. |
| `auth.mfa.passkey.authentication_missing_response` | auth | 400 | error | false | WebAuthn authentication response is required. | Send the client-collected response from `navigator.credentials.get()`. |
| `auth.mfa.passkey.authentication_failed` | auth | 401 | error | true | Passkey authentication could not be verified. | Ensure the credential still exists and that the browser provided a fresh challenge. |
| `auth.mfa.passkey.not_configured` | auth | 404 | warning | false | No passkey credentials exist for this user. | Enroll a passkey before requesting authentication options. |
| `auth.mfa.passkey.not_found` | auth | 404 | warning | false | The referenced passkey credential is not registered. | Ensure the credential ID matches a stored registration before verification. |
| `platform.idempotency_key_missing` | platform | 400 | error | false | An Idempotency-Key header or payload key is required. | Include a stable UUID in the Idempotency-Key header for each write. |
| `platform.idempotency_conflict` | platform | 409 | error | false | The supplied Idempotency-Key has already been used with different parameters. | Re-use the original payload or pick a brand new key. |
| `banking.upstream_timeout` | banking | 504 | warning | true | The upstream banking API timed out before responding. | Retry later or switch to a redundant provider. |
| `banking.upstream_error` | banking | 502 | error | true | The upstream banking API rejected the request. | Inspect provider logs and re-submit when resolved. |

To inspect the catalog programmatically run:

```bash
pnpm exec tsx ./scripts/print-error-catalog.ts
```

The script above simply calls `listErrorCatalog()` and prints the structured metadata so that dashboards and partner documentation stay in sync.
