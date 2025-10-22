# Status site

## Security posture snapshot
- Relies on the API gateway for authenticated admin actions such as organization export and deletion.
- Mirrors platform-wide CORS and upcoming Helmet/CSP policies before exposing embedded status widgets.
- Tracks upcoming audit trail, SBOM/SCA, and privacy export/delete commitments to keep status messaging aligned with actual delivery.

## Current vs planned controls
| Area | Current state | Planned next step | Owner |
| --- | --- | --- | --- |
| Data lifecycle messaging | Publishes admin-triggered export/delete outcomes surfaced from `services/api-gateway`. | [ ] Automate push of export/delete results once audit log sink is live. | `status/` (pending integration) |
| Security headers | Depends on API gateway CORS policy; no additional headers applied yet. | [ ] Adopt Helmet/CSP baseline once middleware lands in `services/api-gateway/src/app.ts`. | `status/` static hosting config |
| Incident comms | Manual updates after admin workflows run. | [ ] Connect to audit log summaries emitted by `shared/` utilities for automated notices. | `status/` + `shared/` |
| Build hygiene | Shares workspace CI defaults; no dedicated SCA/SBOM publishing. | [ ] Consume outputs from `.github/workflows/security.yml` once SBOM + SCA enabled. | `.github/workflows/` |

## Action items
- [ ] Planned: Subscribe to the centralized audit log channel once implemented in `shared/`.
- [ ] Planned: Document Helmet/CSP expectations for the status CDN configuration in `status/`.
- [ ] Planned: Add runbook linkages to data export/delete docs so the status page only advertises shipped capabilities.
