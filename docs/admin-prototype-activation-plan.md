# Admin Prototype Activation Plan

This plan coordinates rollout, validation, and ongoing iteration of the admin prototype while ensuring that production users never encounter unfinished functionality.

## 1. Feature Toggle Lifecycle

| Stage | Default State | Actions | Owner |
|-------|----------------|---------|-------|
| Local Development | OFF (manual) | Enable via `.env` feature flag (e.g., `ADMIN_PROTOTYPE_ENABLED=true`). Use seeded admin accounts. | Prototype dev team |
| Shared QA/Staging | OFF by default | Toggle on only in staging via infrastructure-level flag (LaunchDarkly, ConfigCat, or custom toggle service). Restrict exposure to admin role users. | Release engineer |
| Production | OFF | Gate behind runtime config keyed to explicit allow-list of admin emails/roles. Ensure flag defaults to `false` on cold start. | SRE + Product owner |

### Toggle Controls
1. **Runtime Config:** Expose a single source of truth flag (`adminPrototype.enabled`).
2. **Deployment Safeguards:** CI/CD pipelines must validate that production manifests include `enabled: false` before deployment.
3. **Emergency Kill Switch:** Maintain a `disable` command (`scripts/toggles/disable-admin-prototype.sh`) to flip the flag across environments within five minutes.

## 2. CI/CD Integration

1. **Pipeline Stages**
   - **Build:** Include flag-aware build step to ensure prototype code only bundles into admin-facing packages.
   - **Test:** Run unit tests (Jest/Pytest) with both `enabled=true` and `enabled=false` matrices to confirm isolation.
   - **Security & Lint:** Ensure no public routes reference prototype assets when flag is disabled.
   - **Deploy:** Require manual approval to toggle flag in staging/production, logged in change management tool.

2. **Flag Drift Detection**
   - Add a CI check that scans configuration files (e.g., `webapp/config/*.json`, `infra/helm/values/*.yaml`) to ensure the production flag is `false` unless `RELEASE_CHANNEL=prototype`.
   - Schedule a nightly job that hits `/internal/feature-flags` endpoint and alerts if `adminPrototype` is `true` outside staging.

## 3. Testing Strategy

### Unit Tests
- Add assertions that protected routes/components render fallback UIs when the flag is disabled.
- Verify role-based access control rejects non-admin users even if the flag is accidentally enabled.
- Cover toggle service to ensure default state is `false` when config is missing.

### End-to-End (E2E) Tests
- **Positive path:** In staging, run Playwright/Cypress scenario with admin credentials and flag `true`, confirming prototype flows work end-to-end.
- **Negative path:** Run identical scenario with regular user credentials; ensure prototype entry points (routes, menu items, API responses) remain hidden/return 403.
- **Smoke test:** Execute after every deploy with flag `false` to guarantee no leak in navigation or API payloads.

### Regression Guardrails
- Add a contract test for the `GET /feature-flags` API that exposes flag state; consumer (webapp) must hide prototype when response is `false`.
- Use visual regression for admin shell to detect unexpected prototype components in standard views.

## 4. Branching & Release Strategy

### Branches
- `main`: Production-ready code; prototype flag always `false` in config.
- `prototype/admin-console`: Rapid iteration branch with relaxed review (pair sign-off). Rebase onto `main` at least twice per week.
- Feature branches (`prototype/feature/<slug>`): Short-lived branches branched from `prototype/admin-console` for isolated tasks.

### Promotion Flow
1. Merge feature branches into `prototype/admin-console` after review + automated tests.
2. Nightly CI sync merges `main` -> `prototype/admin-console` to keep parity.
3. When prototype milestone is ready, open PR from `prototype/admin-console` to `main` guarded by full test suite + manual QA sign-off.

### Release Checklist
- [ ] `main` merged into `prototype/admin-console` within last 24 hours.
- [ ] All prototype feature flags default to `false` in production manifests.
- [ ] Unit + E2E tests pass in both flag states.
- [ ] Manual verification in staging: admin sees prototype, regular user does not.
- [ ] Run emergency disable script in staging to confirm response.
- [ ] Update runbook with rollout status and communication plan for stakeholders.

## 5. Monitoring & Observability

- Add dashboard tracking prototype endpoints and feature flag state.
- Alert if non-admin user traffic hits prototype routes (HTTP 403/404 spikes).
- Log feature flag evaluation events to audit exposure windows.

## 6. Communication & Governance

- Maintain dedicated Slack channel (`#admin-prototype`) for rollout discussions and incident response.
- Weekly sync between prototype team and core product team to coordinate roadmap and handoff criteria.
- Document flag state changes in change management system with timestamps, approvers, and rollback plan.

## 7. Rollback Procedures

1. Execute emergency disable script.
2. Redeploy production with `enabled=false` to ensure flag state persists across restarts.
3. Re-run smoke tests (unit + E2E negative path).
4. Communicate rollback to stakeholders and record root cause.

This plan enables rapid prototype iteration without jeopardizing the production experience for regular users.
