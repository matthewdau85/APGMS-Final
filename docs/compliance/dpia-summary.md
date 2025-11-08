# DPIA Summary

This summary distils the full DPIA (`../privacy/dpia.md`) into the checkpoints
auditors ask for during onboarding. Each item links to code or automated
evidence so reviewers can trace enforcement without reading the entire
assessment.

## Processing scope

- **Data subjects**: payroll administrators, finance approvers, and designated
  regulator contacts held in `User` and `Org` tables (`shared/prisma/schema.prisma`).
- **Personal data**: work emails, TFNs, ABNs, payroll bank-line summaries, MFA
  credentials, and regulator session metadata (`services/api-gateway/src/routes/auth.ts`,
  `services/api-gateway/src/app.ts`).
- **Lawful basis**: contractual necessity for payroll fulfilment plus TFN consent
  captured during onboarding (`docs/security/TFN-SOP.md`).

## Key data flows & storage

1. **Authentication** – Email/password combinations are verified via bcrypt,
   sessions issued as JWTs with MFA flags, and regulator sessions isolated under
   a separate audience (`services/api-gateway/src/auth.ts`).
2. **Bank & TFN processing** – Bank lines and TFNs are envelope encrypted or
   tokenised with keyed salts; decrypt routes emit audit events and require
   explicit admin guards (`services/api-gateway/src/lib/pii.ts`).
3. **Evidence lifecycle** – Designated account reconciliations and regulator
   exports are stored as append-only evidence artifacts with SHA-256 hashes and
   WORM URIs (`domain/policy/designated-accounts.ts`,
   `services/api-gateway/src/app.ts`).
4. **Monitoring & alerts** – Regulator portal requests capture actor IDs and
   actions such as `regulator.evidence.list` for immutable audit review
   (`services/api-gateway/src/app.ts`).

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Credential compromise | Medium | High | JWT issuer/audience pinning, per-request auth guard, and MFA enrolment with recovery code hashing (`services/api-gateway/src/auth.ts`, `services/api-gateway/src/routes/auth.ts`). |
| TFN disclosure | Low | High | Tokenisation, AES-256-GCM encryption, admin-only decrypt routes, and audit logging (`services/api-gateway/src/lib/pii.ts`). |
| Evidence tampering | Low | Medium | WORM promotion and SHA-256 digesting of compliance artifacts (`domain/policy/designated-accounts.ts`). |
| Regulator misuse | Low | Medium | Access code verification, short-lived regulator sessions, and dedicated smoke coverage (`services/api-gateway/src/routes/regulator-auth.ts`, `scripts/regulator-smoke.mjs`). |

## Residual risk & review cadence

- Residual risk remains **Low** while encryption keys and salts are rotated
  quarterly per TFN SOP (`docs/security/TFN-SOP.md`).
- Review the full DPIA when onboarding new data categories, regulator
  requirements, or cross-border processing.
- Capture DPIA confirmation in the release checklist and attach updated evidence
  when controls change.
