# Control Maps

This matrix links every control to the code path and automated evidence that
prove enforcement. Pair it with the release evidence bundle for a 30-minute
verification trail.

## OWASP ASVS Controls

| Control | Implementation | Verification |
| --- | --- | --- |
| ASVS V1.2.3 – Harden HTTP headers | [app.ts] registers Helmet with CSP and frameguard. | [security.headers.spec.ts] checks CSP, X-Content-Type-Options, and CORS decisions. |
| ASVS V2.1.1 – Validate sessions | [auth.ts] issues and verifies JWTs with issuer/audience pinning. | [auth.guard.spec.ts] covers issuer, audience, expiry, and scope rejection paths. |
| ASVS V6.2.2 – Encrypt sensitive data | [pii.ts] tokenises TFNs and encrypts PII with AES-256-GCM. | [pii.spec.ts] proves TFNs stay hidden and non-admin decrypt is blocked. |
| ASVS V10.3.1 – Audit security events | [pii.ts] emits structured audit events for decrypt requests. | [pii.spec.ts] checks audit payloads for safe metadata. |

## DSP Operational Framework Controls

| Control | Implementation | Verification |
| --- | --- | --- |
| DSP 5.1 – Immutable evidence | [designated-accounts.ts] writes SHA-256 digests and promotes WORM URIs. | [designated.policy.spec.ts] confirms artifact kind, hash, and audit logs. |
| DSP 6.2 – Regulator session isolation | [app.ts] scopes `/regulator/*`, injects regulator context, and logs every action. | [regulator-smoke.mjs] exercises login, evidence, monitoring, and bank summary. |
| DSP 7.4 – Dual-controlled erasure | [admin.data.ts] enforces admin auth, confirmation tokens, and security logging. | [admin.data.delete.spec.ts] covers unauthorized, confirm-token, and anonymisation cases. |

## TFN Safeguards (ATO TFN Rule s11)

| Control | Implementation | Verification |
| --- | --- | --- |
| TFN 11(a) – Tokenise TFNs | [pii.ts] applies keyed HMAC tokenisation and never stores raw IDs. | [pii.spec.ts] asserts tokens omit raw TFNs and resist unauthorised decrypt. |
| TFN 11(b) – Restrict access | [pii.ts] guards `/admin/pii/decrypt` behind admin-only checks and audit logging. | [pii.spec.ts] denies non-admin decrypt attempts and inspects audit output. |
| TFN 11(c) – Evidence traceability | [app.ts] records `regulator.*` actions with actor IDs and session metadata. | [designated.policy.spec.ts], [regulator-smoke.mjs] show audit trails and automated evidence retrieval. |

## How to use this map

1. Locate the control above.
2. Follow the implementation link to inspect the guard code.
3. Run or review the matching automated test or smoke script.
4. Attach the command output to `artifacts/compliance/<release>.md`.

[admin.data.delete.spec.ts]: ../../services/api-gateway/test/admin.data.delete.spec.ts
[admin.data.ts]: ../../services/api-gateway/src/routes/admin.data.ts
[app.ts]: ../../services/api-gateway/src/app.ts
[auth.guard.spec.ts]: ../../services/api-gateway/test/auth.guard.spec.ts
[auth.ts]: ../../services/api-gateway/src/auth.ts
[designated-accounts.ts]: ../../domain/policy/designated-accounts.ts
[designated.policy.spec.ts]: ../../services/api-gateway/test/designated.policy.spec.ts
[pii.spec.ts]: ../../services/api-gateway/test/pii.spec.ts
[pii.ts]: ../../services/api-gateway/src/lib/pii.ts
[regulator-smoke.mjs]: ../../scripts/regulator-smoke.mjs
[security.headers.spec.ts]: ../../services/api-gateway/test/security.headers.spec.ts
