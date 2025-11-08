# Data Protection Impact Assessment

## Overview
- **Processing**: APGMS ingests organisation profile details, user contact emails, and transactional bank-line summaries.
- **Lawful basis**: Customer contracts and TFN handling consent; audit logging retains minimal metadata for compliance.

## Data Inventory & Flow
- User credentials stored with Argon2id hashing and peppering (shared/src/security/password.ts:1).
- Bank lines encrypted at rest via envelope keys managed by the runtime KMS provider; only decrypted when a privileged admin exports data (services/api-gateway/src/app.ts:333).
- Audit logs capture actor, action, and timestamps in append-only records (shared/prisma/schema.prisma:47).

## Risk Assessment
- **Unauthorised access**: Mitigated by HS256 JWT authentication, per-route RBAC, anomaly detection and Prometheus counters for failed auth; admin data erasure/export routes reuse the same JWT verifier so legacy bearer tokens are no longer accepted (services/api-gateway/src/app.ts:73, services/api-gateway/src/routes/admin.data.ts:67).
- **Data leakage**: Responses redact emails, hash identifiers, and avoid sharing raw payee descriptions unless explicitly exported with admin scope (services/api-gateway/src/app.ts:247).
- **Key compromise**: Encryption keys and salts are loaded via environment-driven KMS providers with rotation support (services/api-gateway/src/security/providers.ts:12).

## Controls & Monitoring
- Helmet CSP/HSTS, a fail-closed CORS allow-list, and Playwright accessibility checks run in CI to guard regressions (services/api-gateway/src/app.ts:224, .github/workflows/ci.yml:36).
- Tax-engine proxy inherits JWT enforcement and validates upstream responses before returning to clients (services/api-gateway/src/routes/tax.ts:1).
- Security workflow runs SBOM generation, dependency SCA, Semgrep, Gitleaks, and Trivy scans on every push (.github/workflows/security.yml:23).
- Metrics and audit events feed Prometheus (services/api-gateway/src/plugins/metrics.ts:4) enabling alerting when export/delete operations occur.

## Residual Risk & Actions
- Residual risk rated **Low** given encryption, logging, and monitoring coverage. Key rotation documented in TFN SOP (docs/security/TFN-SOP.md).
- Review DPIA quarterly or when introducing new data categories.
