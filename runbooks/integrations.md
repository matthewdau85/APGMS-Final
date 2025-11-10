# Integration Runbook

This runbook outlines how we onboard new upstream integrations, manage OAuth2 credentials, rotate secrets, and verify signature and remittance flows across banking, payroll, POS, and ATO services.

## Banking connectors

* **Provisioning**
  * Request client credentials from the banking partner and capture the `tokenUrl`, `clientId`, and `clientSecret` in 1Password under the "Banking Connectors" vault.
  * Generate a webhook signing secret (32+ bytes) and register it with the provider. Store the same secret in Vault under `kv/integrations/banking/<provider>`.
  * Configure environment variables for the connector runtime:
    * `BANKING_BASE_URL`
    * `BANKING_TOKEN_URL`
    * `BANKING_CLIENT_ID`
    * `BANKING_CLIENT_SECRET`
    * `BANKING_WEBHOOK_SECRET`
* **Verification**
  * Use the `BankingConnectorClient` from `services/connectors` to issue a `/accounts/:id/transactions` call for a sandbox account. Ensure HTTP signature verification passes for webhook echoes using the `verifyWebhook` helper.
* **Credential rotation**
  * Schedule quarterly rotations. Generate a new secret, update Vault, and perform a rolling deployment. Because OAuth tokens are cached with a 60 second grace window, coordinate with the provider so the previous secret remains valid for at least 5 minutes.

## Payroll connectors

* **Provisioning**
  * Record OAuth credentials and STP scopes (`payroll:stp.submit`) in Vault at `kv/integrations/payroll/<provider>`.
  * Register our webhook callback URL, ensuring the provider sends signature headers. The shared secret should be rotated semi-annually.
* **Cut-over checklist**
  * Trigger a dry-run STP submission using `PayrollConnectorClient.submitStp` against a test pay run.
  * Validate that webhook acknowledgements flow back via `acknowledgeWebhook`.

## POS connectors

* **Onboarding**
  * Capture base URL and webhook secret in Vault.
  * Register locations and ensure `PosConnectorClient.listSales` returns data for the last 24 hours.
* **Signature health-check**
  * Execute the `verifyWebhook` helper with a known payload. If verification fails, rotate the secret and retry.

## ATO (BAS/STP)

* **Environment configuration**
  * Populate the following variables for worker deployments:
    * `ATO_BASE_URL`
    * `ATO_TOKEN_URL`
    * `ATO_CLIENT_ID`
    * `ATO_CLIENT_SECRET`
    * `ATO_SCOPE` (default `"bas stp"`)
  * Credentials must be rotated every 90 days. Create a new client in Relationship Authorisation Manager (RAM), update Vault, deploy, then revoke the previous client after confirming successful submissions.
* **Submission workflow**
  * Workers call `queueOutstandingStpReports` hourly to enqueue STP remittances for committed pay runs.
  * `dispatchQueuedStpReports` handles the actual STP lodgement using the `AtoClient` module.
  * `processScheduledBasRemittances` runs nightly after designated account reconciliation and schedules BAS payments via the ATO APIs.
* **Audit expectations**
  * Every dispatch appends an immutable chain entry in `AuditLog` capturing reference IDs, receipts, and error states. Verify the chain by comparing `hash` and `prevHash` fields when investigating incidents.

## Credential rotation playbook

1. Create a new secret pair (client secret, webhook key) in the provider console.
2. Store the secrets in Vault and 1Password, tagging with rotation date.
3. Update Kubernetes secrets and restart the affected pods. The OAuth helper refreshes tokens lazily, so expect a 1–2 minute window before new credentials are used.
4. Confirm connectivity using the appropriate connector test (`listTransactions`, `submitStp`, or `scheduleBasPayment`).
5. Revoke the old credential once traffic has stabilised.

## Monitoring & alerting

* Alerts for webhook signature failures are surfaced via `designatedAccountState` entries with `VIOLATION` status.
* Remittance jobs raise audit events ending in `.error`. Wire these into PagerDuty with a high severity rule to catch repeated failures (>=3 attempts).
