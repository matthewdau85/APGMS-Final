# End-to-End Onboarding Setup Guide

This guide consolidates the kickoff checklist that our early adopters requested. Share it with security, IT, and implementation teams so they can work in parallel. It assumes you have an assigned customer success manager (CSM) who can unblock environment access.

## 1. Pre-flight (Week 0)

1. **Security & Networking**
   - Review the SOC 2 Type II + pen-test packet in `docs/security/`.
   - Submit our static IP ranges (`34.210.93.80/28`, `44.230.10.0/28`) for firewall allow-listing.
   - Confirm whether data residency in the US or EU regions is required.
2. **Account Provisioning**
   - Send the list of administrators for Console + API access.
   - Decide on SSO (SAML/OIDC) vs. password login. If SSO, provide IdP metadata.
3. **Data Ownership**
   - Identify a data steward for payroll and POS exports.
   - Export five historical pay periods so we can seed the sandbox.

## 2. Environment Setup (Week 1)

| Task | Owner | Details |
| --- | --- | --- |
| Request sandbox org | CSM | Use the Console → Admin → Organizations flow. Includes seeded payroll fixtures. |
| Generate API keys | Developer lead | `POST /v1/api-keys` or Console. Keys include label + scopes. |
| Configure webhooks | Developer lead | Register `https://<customer>/webhooks/apgms`. Use the signing secret from Console. |
| Install SDK | Engineer | `pnpm add @apgms/sdk-typescript` or `pip install apgms-sdk`. |
| Enable audit logging | CSM | Toggle in Console. Streams every mutation into the audit queue. |

## 3. Build (Weeks 2–3)

1. **Map payroll or POS schemas** using the sample adapters in `examples/` as a starting point.
2. **Implement sync jobs** with the SDK retry helpers.
3. **Validate permissions** by exercising the OpenAPI collection and TypeDoc reference in `packages/api/docs/`.
4. **Instrument observability** – stream logs to your SIEM via the `GET /v1/events` endpoint or use the built-in Honeycomb exporter.

## 4. Test & Dry Run (Week 4)

* Run `pnpm test:onboarding` (see scripts below) to execute contract tests against sandbox data.
* Generate a dry-run report using `POST /v1/migrations/dry-run`.
* Share the report + console screenshots with stakeholders for approval.

## 5. Launch (Week 5)

1. Request production org enablement via the CSM. Provide cutover date.
2. Rotate all API keys (sandbox keys remain active for testing).
3. Switch webhook target to production queue.
4. Monitor the migration dashboard for 24 hours before declaring success.

## 6. Rollback & Support

* Rollback by flipping the routing flag in Console → Launch Control or calling `POST /v1/migrations/<id>/rollback`.
* Audit logs and event replay are available for 30 days; export them if you need long-term retention.
* Slack and PagerDuty escalation paths are documented in `runbooks/oncall.md`.

## Reference Scripts

```bash
pnpm --filter @apgms/api exec typedoc
pnpm --filter @apgms/api exec openapi-generator-cli validate -i openapi.yaml
pnpm --filter @apgms/sdk-typescript test
```
