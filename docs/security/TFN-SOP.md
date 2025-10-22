# TFN handling SOP

## Objectives
- Protect Tax File Number (TFN) artifacts behind the same admin-token gate used for other high-risk data.
- Ensure cross-origin requests are tightly controlled before TFN-bearing APIs are exposed to browsers.
- Provide auditable records of TFN access, export, and deletion events for regulatory reviews.

## Current vs planned response controls
| Phase | Current control | Owner | Planned follow-up |
| --- | --- | --- | --- |
| Intake | Admin token checked on `/admin/export/:orgId` before TFN-bearing exports run. | `services/api-gateway/src/app.ts` | [ ] Build dedicated TFN request queue with per-request approvals in `services/api-gateway/src/routes/`. |
| Processing | Tombstone payload includes full organization snapshot during deletion, preventing silent TFN loss. | `services/api-gateway/src/app.ts` | [ ] Redact TFNs in exported payloads prior to archival in `worker/` jobs. |
| Logging | Security events default to `app.log.info` with `security_event` tags. | `services/api-gateway/src/routes/` | [ ] Ship structured audit entries to centralized storage via `shared/` logging helpers. |
| CI guardrails | `security.yml` workflow stub runs on every push (placeholder). | `.github/workflows/security.yml` | [ ] Add SCA (e.g., `pnpm audit`) and SBOM generation in the same workflow. |

## Operating notes
- TFN exports or deletions are triggered manually by admins using the `x-admin-token` header, keeping the surface area small.
- CORS is currently permissive (`origin: true`); update the allow-list before exposing TFN APIs to untrusted domains.
- Audit trail expansion is required before TFNs move beyond manual flows.

## Action tracker
- [ ] Planned: Harden CORS policy and add Helmet/CSP before enabling browser-based TFN tooling in `services/api-gateway/src/app.ts`.
- [ ] Planned: Persist TFN audit events to a tamper-evident store via `shared/observability` (to be created).
- [ ] Planned: Automate SBOM + SCA checks inside `.github/workflows/security.yml`.
