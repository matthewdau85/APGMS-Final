# Enablement, CI/CD, and Training

## Runbook Inventory
- `runbooks/ops.md`: Deployment, readiness, and dependency validation procedures.
- `docs/runbooks/compliance-monitoring.md`: PAYGW/GST alert lifecycle, audit evidence capture.
- `docs/runbooks/designated-accounts-governance.md`: Managing designated banking credentials and reconciliation evidence.
- `docs/runbooks/stakeholder-connect.md`: First-run checklist for regulators, banking partners, and customers.
- `docs/ops/ha-dr-plan.md`: HA/DR execution plan including drills and RTO/RPO metrics.

All runbooks are version-controlled in this repository; updates require PR + approval from Ops and Compliance leads.

## CI/CD Pipeline
- GitHub Actions workflow `deploy-main` builds, runs tests (`pnpm test`, `pnpm lint`, `pnpm k6:smoke`), builds Docker images, and deploys via Argo CD sync hooks.
- Feature branches use `deploy-preview` to spin ephemeral environments with masked banking credentials.
- Secrets pulled at runtime from Vault via OIDC; no static credentials stored in GitHub.
- Pipeline status surfaced on the Operational Health dashboard; failures block production deploys until resolved.

## Automated Deployments
1. Developer merges to `main` after approvals.
2. GitHub Actions builds artifacts and signs container images with cosign.
3. Argo CD detects new image tags and syncs manifests to all regions, respecting progressive delivery (25%/50%/100%) with canary analysis using Prometheus.
4. Post-deploy hooks run smoke tests and update `status/README.md` with release badge (future automation tracked in `OPS-139`).

## Training Materials
- **Internal support**: Slide deck + demo script at `artifacts/training/internal-support-2025-03.pdf` covering onboarding, incident triage, and dashboard usage.
- **Customer onboarding**: Quick start guide `docs/success/playbooks.md` now includes new dashboard walkthrough and FAQ (updated March 2025).
- **Workshops**: Monthly enablement sessions recorded and stored in `artifacts/training/recordings/`. Attendance tracked below.

### Training Log
| Date | Audience | Topic | Attendees |
| --- | --- | --- | --- |
| 10 Mar 2025 | Support L1/L2 | Incident response & DR drills | 14 |
| 17 Mar 2025 | Harbour Payroll finance | Dashboard walkthrough + BAS deadlines | 9 |
| 20 Mar 2025 | Westfield Markets ops | PAYGW discrepancy handling | 12 |

## Next Actions
- Automate runbook linting (Docs-as-Code) via Vale in CI by April 2025.
- Schedule refresher training aligned with next DR tabletop (18 June 2025).
- Expand customer-facing knowledge base articles based on pilot feedback (ticket CS-88).
