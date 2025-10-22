# OWASP ASVS L2

## Scope of current coverage
- Admin endpoints require an `x-admin-token` header before exporting or deleting organization data. These map to ASVS 2.1 and 2.2 for authentication and session management.
- Cross-origin traffic is limited via the Fastify CORS plugin; Helmet-style HTTP header hardening and CSP rules are tracked as planned upgrades.
- Deletion endpoints persist organization data to an export payload before removal, supporting ASVS 9.4 data lifecycle controls.
- CI security workflow exists as a scaffold and will grow to include software composition analysis (SCA) and SBOM publishing.
- Audit logging hooks exist in admin data routes and will evolve into a central immutable audit trail.

## Current control coverage
| Control | Status | Owner | Notes |
| --- | --- | --- | --- |
| Admin-only export at `/admin/export/:orgId` | Current | `services/api-gateway/src/app.ts` | `requireAdmin` validates the configured admin token before exporting organization data. |
| Admin-only deletion at `/admin/delete/:orgId` | Current | `services/api-gateway/src/app.ts` | Deletes cascade through Prisma and capture a tombstone payload for recovery. |
| Cross-origin policy via Fastify CORS | Current | `services/api-gateway/src/app.ts` | `app.register(cors, { origin: true })` limits access to known origins until stricter policies are defined. |

## Planned enhancements
- [ ] Planned: Introduce Helmet-equivalent security headers and baseline CSP in `services/api-gateway/src/app.ts`.
- [ ] Planned: Enforce auth middleware on public read endpoints in `services/api-gateway/src/app.ts` once user/session model lands.
- [ ] Planned: Forward admin data security log entries to a durable audit log in `services/api-gateway/src/routes/` and `shared/` logging utilities.
- [ ] Planned: Replace the placeholder GitHub security workflow with SBOM generation and dependency SCA in `.github/workflows/security.yml`.

## References
- Fastify application bootstrap shows current admin and CORS controls in `services/api-gateway/src/app.ts`.
