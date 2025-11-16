# Customer Success Playbooks

## Onboarding Checklist
1. Provision designated PAYGW/GST accounts with Southern Cross Mutual; confirm deposit-only flag is active.
2. Invite customer admins via `/admin/orgs/:id/users` and enforce MFA (Okta + WebAuthn backup codes).
3. Run guided ingestion dry-run:
   - Upload sample payroll file via `/ingest/payroll` (use `--validate-only`).
   - Review `/compliance/precheck` output together and document remediation steps.
4. Share dashboard walkthrough covering PAYGW/GST tiles, forecast tiers, BAS deadlines, and discrepancy alerts.
5. Capture sign-off in `artifacts/compliance/onboarding/<org>.pdf`.

## Success Metrics
- **Time to first reconciliation**: Target < 2 business days post-contract.
- **Alert resolution SLA**: 90% resolved within 4 hours.
- **Dashboard adoption**: ≥80% of invited users log in within first week.
- Track metrics via Customer Health board in Gainsight; sync weekly into `status/pilots/2025-03-live-trials.md` for pilot customers.

## Escalation Paths
- Product gaps → raise in Jira epic `CS-Backlog`.
- Banking issues → page on-call via `Bank Adapter` service and reference `docs/partners/banking-integration.md`.
- Compliance/audit queries → engage compliance lead and follow `docs/runbooks/compliance-monitoring.md`.

## Playbook Library
| Scenario | Steps |
| --- | --- |
| BAS deadline approaching | Use dashboard BAS timeline, export outstanding liabilities, send automated reminder template `artifacts/templates/bas-reminder.md`. |
| Discrepancy detected | Validate queue depth in Operational dashboard, re-run reconciliation job, document alert resolution evidence. |
| Pilot expansion | Clone onboarding checklist, update `status/pilots/*` with new org details, ensure training session scheduled per `docs/runbooks/enablement.md`. |

## Resources
- Training deck: `artifacts/training/customer-dashboard-2025-03.pdf`
- Knowledge base: `https://kb.apgms.io/obligations`
- Support SLAs: `runbooks/ops.md#common-alerts`
