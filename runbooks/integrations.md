# Integration Runbook

## Overview
This runbook outlines the operational procedures for managing external integrations that power banking, payroll, point-of-sale (POS), and ATO reporting flows. It covers onboarding new tenants, rotating credentials and signing keys, and responding to common failure scenarios. The audiences are the customer operations team (for onboarding actions) and the on-call/infra teams (for rotations and incident response).

---

## 1. Onboarding Playbooks

### 1.1 Banking Connectors
1. Collect the customer's banking API credentials (client ID/secret, webhook signing key, base URLs) via the secure intake form.
2. In the admin console set the integration status to **Pending Verification**; this triggers the connectors service to perform an OAuth2 test handshake using the sandbox scope.
3. Review the connectors service logs for `banking.connector.test.ok` to confirm a valid access token was acquired. If the log contains `invalid_client` halt onboarding and notify the customer to re-issue credentials.
4. Configure deposit-only designated accounts for PAYGW and GST buffers in the ledger UI. These accounts must have the **Deposit only** flag enabled; the API will reject funding attempts otherwise.
5. Enable webhooks by pasting the provided callback URL into the banking partner’s portal and verifying the first signature using the `/integrations/verify-webhook` diagnostic endpoint.
6. Flip the integration to **Active**. Run the `banking:sync` worker job once to backfill historic transactions.

### 1.2 Payroll (STP) Connector
1. Gather the ATO software ID, STP client ID, client secret, and confirm the submitting ABN.
2. Add credentials to the secure configuration store (`infra/config/stp/<tenant>.json`). Apply the config via Terraform or Secrets Manager.
3. In the payroll app mark the tenant as **STP Enabled**; this adds the pay-run level checks that ensure committed runs have employee TFN hashes.
4. Execute the dry-run command `pnpm worker runScheduledAtoSubmissions --dry-run --tenant <tenantId>` to confirm payload generation without submitting to the ATO.
5. Capture approval from the compliance lead and switch the tenant to **Production**. Monitor the first live submission in Cloud Logging for `stp.submit.success`.

### 1.3 POS Connector
1. Request the POS API credentials and webhook signing secret. Confirm which locations are in scope.
2. Use the integration CLI `pnpm connectors:pos:verify --tenant <tenantId>` to validate the OAuth2 token and signature configuration.
3. Enable the connector in the admin UI and confirm receipts flow into the GST ledger by checking the nightly reconciliation artifact.

---

## 2. Credential and Key Rotation

### 2.1 OAuth2 Client Secrets
- Store banking, payroll, and POS OAuth2 client secrets in the secrets manager under `integrations/<tenant>/<service>/`.
- To rotate, create a new version in the secrets manager, update the connectors or ATO worker deployment with the new ARN/version, and trigger a rolling restart.
- Verify by tailing the relevant service logs for `oauth.token.refresh` entries; no errors should be present.
- After confirmation, disable the old secret in the partner portal and mark the rotation task as complete in the ticketing system.

### 2.2 Webhook Signing Keys
- POS and banking webhooks rely on shared HMAC secrets. Schedule rotations quarterly.
- Generate a new secret using the HSM backed CLI (`tools/gen-webhook-secret.ts`).
- Update the partner portal and the corresponding environment variable (`BANK_WEBHOOK_SECRET`, `POS_WEBHOOK_SECRET`).
- Validate with the self-check endpoint `POST /integrations/webhook-test` providing a signed payload; expect HTTP 204.
- Maintain dual-secret overlap for 24 hours where possible to ensure retries succeed.

### 2.3 ATO Machine Credentials
- Rotate `ATO_CLIENT_ID` and `ATO_CLIENT_SECRET` annually or upon ATO request.
- Use the ATO Access Manager to issue a new machine credential, upload it to the secure key store, and update the worker deployment variables.
- Run `pnpm worker runScheduledAtoSubmissions --tenant <tenantId>` in dry-run mode to ensure the new credential is accepted before revoking the old one.

---

## 3. Failure Playbooks

### 3.1 OAuth2 Token Failures
1. Symptom: connectors service logs `oauth.token.refresh_failed` and integrations return HTTP 401.
2. Actions:
   - Check secret validity in the secrets manager and confirm it matches the partner portal.
   - Trigger manual token refresh using `pnpm connectors:token --tenant <tenantId> --service banking`.
   - If still failing, raise a Sev2 incident and coordinate credential re-issue with the partner.

### 3.2 Webhook Signature Mismatch
1. Symptom: incoming webhooks rejected with `signature_invalid`.
2. Actions:
   - Retrieve the last payload from the DLQ/SQS queue and re-compute the HMAC using the stored secret.
   - If mismatch persists, enable dual-secret mode and request the partner to re-send the webhook.
   - Monitor audit logs (`DesignatedAccountAuditLog`) to ensure no unauthorized deposits were recorded.

### 3.3 ATO Submission Errors
1. Symptom: worker logs show `Failed to submit STP/BAS` with `403` or `5xx` responses.
2. Actions:
   - Inspect the worker job output to confirm payload validity (`--dry-run` if needed).
   - Re-queue the job by triggering `pnpm worker runScheduledAtoSubmissions`.
   - For repeated 4xx errors escalate to the compliance lead; contact the ATO gateway support with the lodgement reference.

### 3.4 Reconciliation Discrepancies
1. Symptom: designated account reconciliation entries move to `ESCALATED` status.
2. Actions:
   - Compare the `observedBalance` vs `recordedBalance` in the `DesignatedAccountReconciliation` table.
   - Trace recent transfers via the `DesignatedAccountAuditLog` chain to locate missing deposits.
   - If a withdrawal is detected, raise an immediate Sev1 incident and freeze the account via the bank portal.

---

## 4. Contact Matrix
- **Compliance Lead:** compliance@apgms.example — owns regulator communications.
- **Integrations On-call:** #integrations-oncall (PagerDuty schedule).
- **Banking Partner Support:** support@banking-partner.example.
- **ATO Support:** 1300 852 232 (quote the machine credential ID).

Keep this runbook version-controlled and update after every incident post-mortem.
