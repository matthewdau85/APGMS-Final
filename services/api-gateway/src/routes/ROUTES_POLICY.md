# APGMS API Gateway Routes Policy

Purpose: prevent route drift by defining which route modules are registered in each runtime mode.

## Packs

### Core (always on)
Core routes MUST be registered in all normal runtime modes.

Includes:
- health.ts
- version.ts
- schemas.ts
- auth.ts
- auth-mfa.ts
- org-setup.ts
- org-settings.ts
- setup.ts
- onboarding.ts
- integration-events.ts

Core business routes (wire if/when the webapp depends on them):
- alerts.ts
- connectors.ts
- connectors-bank.ts
- bank-lines.ts
- designated-accounts.ts
- payment-plans.ts
- transfers.ts
- tax.ts
- gst.ts
- payroll.ts
- evidence.ts
- evidence-pack.ts
- export.ts
- bas-preview.ts
- bas.ts
- bas-settlement.ts
- settlements-bas.ts
- ready.ts

Notes:
- "Core business routes" are considered part of core mode when the UI calls them.
- If a core business route is not yet used, it may remain unwired temporarily, but must be moved into the Core pack once the UI depends on it.

### Prototype (opt-in)
Prototype routes MUST NOT be registered unless explicitly enabled.

Enable via:
- APGMS_ENABLE_PROTOTYPE=1

Includes (typical):
- prototype.ts
- prototype-monitor.ts
- 20-prototype-monitor-risk-summary.ts
- demo.ts
- ingest-csv.ts
- forecast.ts
- training.ts

### Admin (always on, protected)
Admin routes MUST be registered in all runtime modes, but MUST be protected by admin guards.

Includes:
- admin.ts
- admin-agent.ts
- admin-regwatcher.ts
- admin-demo-orchestrator.ts
- admin-users.ts
- admin-service-mode.ts
- admin.data.ts (only if actively used)

Notes:
- Do not wire dot-variant duplicates like admin.agent.ts or admin.regwatcher.ts. Keep hyphen variants canonical.

### Regulator (opt-in)
Regulator routes MUST NOT be registered unless explicitly enabled.

Enable via:
- APGMS_ENABLE_REGULATOR=1

Includes:
- regulator-auth.ts
- regulator.ts
- regulator-compliance-evidence-pack.ts
- regulator-compliance-summary.ts
- regulator-compliance-summary.service.ts
- regulator-compliance-summary.demo.ts

## Enforcement rules

1) app.ts MUST NOT directly register route files (except calling routes/index.ts).
2) routes/index.ts is the single authoritative wiring list.
3) New route files must be added to exactly one pack (Core, Prototype, Admin, Regulator).
4) Duplicate naming variants must be resolved (prefer kebab-case filenames).
5) If a route is added to Core, add at least one curl/smoke check to validate it is reachable (not 404).

