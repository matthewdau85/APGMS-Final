# Security Policy

Our customers rely on APGMS to move payroll and GST data, so we publish this policy to make it easy to report issues and to show which safeguards are already in place.

## Reporting a vulnerability
- Email `security@yourdomain.example` with the details, reproduction steps, and any logs you can share securely.
- We acknowledge within **2 business days**, provide status updates at least weekly, and coordinate public disclosure once a fix ships.
- If the report contains TFNs or other PII, encrypt the payload with our support team's GPG key (available on request) or ask for a secure file drop link.

## Coordinating investigations
- Production incidents follow the [Notifiable Data Breach runbook](runbooks/ndb.md) so executive, legal, and customer comms stay aligned and OAIC notifications happen inside the statutory window.
- All code or infrastructure changes that touch authentication, secrets, or compliance features must attach references to the relevant runbook (admin controls, secrets management, compliance monitoring) so reviewers can trace the control evidence trail.

## Platform safeguards and evidence
### Multi-factor enforcement and privileged flows
- `/auth/login` sets an `mfaEnabled` flag on the signed JWT, and the MFA verification route refuses BAS lodgment or alert-resolution flows when the proof is missing (`services/api-gateway/src/auth.ts`, `services/api-gateway/src/routes/auth.ts`).
- The web application surfaces the same guard rails by prompting for an MFA challenge before BAS lodgment, alert resolution, or enabling MFA across an organisation (`webapp/src/BasPage.tsx`, `webapp/src/AlertsPage.tsx`, `webapp/src/SecurityPage.tsx`).

### JWT/session integrity
- `createAuthGuard` verifies issuer/audience, enforces RS256/HS256 signatures, and attaches the authenticated principal to every Fastify request so downstream routes can enforce org/role scopes (`services/api-gateway/src/auth.ts`).
- Deployment manifests define the JWT inputs (`AUTH_AUDIENCE`, `AUTH_ISSUER`, `AUTH_JWKS`, `AUTH_DEV_SECRET`) so infrastructure teams can prove how tokens are signed in each environment (`docker-compose.yml`).

### Audit logging and administrator traceability
- `recordAuditLog` chains SHA-256 hashes per org so privileged actions (auth, regulator requests, compliance events) have tamper-resistant evidence with timestamps and metadata (`services/api-gateway/src/lib/audit.ts`).
- Admin delete/export routes log both an anonymised `security_event` entry and a durable audit record, ensuring auditors can trace `x-correlation-id` headers back to the originating action (`services/api-gateway/src/routes/admin.data.js`, `shared/src/security-log.ts`).

### Secrets management and key rotation
- `pnpm security:rotate-keys --write-env .env` wraps `scripts/rotate-pii-keys.mjs` to issue new RSA JWKS entries plus envelope-key material, updating `.env` or vault secrets in one run (`package.json`, `scripts/rotate-pii-keys.mjs`).
- The [Secrets Management runbook](docs/runbooks/secrets-management.md) documents where each secret lives, how rotations are recorded, and how to collect the evidence pack after deploying the new material.

### TFN and other PII handling
- The [TFN standard operating procedure](docs/security/TFN-SOP.md) explains how to scrub or encrypt TFNs at the transport edge, document their use, and dispose of artefacts after regulator submissions.
- Controls mapped in the [OWASP ASVS matrix](docs/security/ASVS-mapping.md) cover how authentication, logging, and crypto protections line up with the DSP OSF governance and IAM requirements referenced in this policy.

### Continuous compliance hooks
- Compliance monitoring and admin control runbooks describe how to capture ingestion evidence, OSF questionnaire exports, and remediation tickets under `artifacts/compliance/` (`docs/runbooks/compliance-monitoring.md`, `docs/runbooks/admin-controls.md`).
- Tracking files inside `docs/dsp-osf/` and `status/` store the latest questionnaires, evidence pointers, and regulator product IDs so every submission remains reproducible.
- The ASVS mapping file inside `docs/security/` lists the defensive controls (MFA, JWT guardrails, audit logs, key rotation) that appear throughout the OSF documentation set so auditors can traverse between standards without re-validating the same feature twice.

## Coordinated disclosure timeline
1. **Triage (0-2 days):** reproduce, assign severity, and open an incident channel if customer data may be at risk.
2. **Mitigation (<=7 days for high/critical):** ship code/config fixes, rotate any affected secrets, and confirm via automated tests plus targeted smoke checks.
3. **Retrospective:** document the root cause, attach logs/evidence to the incident record, and update runbooks or automations so the issue cannot recur unnoticed.
