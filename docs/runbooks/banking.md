# Banking Provider Runbook

This document captures the operational steps for configuring and running the read-only banking adapters, including the new Basiq connector.

## Basiq configuration

1. **Create a read-only workspace in Basiq.**
   - Provision a service-to-service API key with `transactions.read` and `accounts.read` scopes.
   - Record the Organisation ID that maps to the customer in APGMS.
2. **Populate environment variables.** Set these in the API gateway (and any workers that rely on the provider factory):
   ```bash
   export BASIQ_API_URL="https://au-api.basiq.io"
   export BASIQ_API_KEY="<server-to-server token>"
   export BANKING_PROVIDER_ID="basiq"
   ```
   The `BASIQ_API_URL` can point at Basiq's sandbox. The API key must never be committed to source control.
3. **Deploy and verify.**
   - Restart the `services/api-gateway` process with the new env vars.
   - Tail logs for `banking-provider` events to confirm the adapter is selected and the read caps (`maxReadTransactions` / `maxWriteCents`) match expectations.
   - Use `/compliance/status` to confirm the connector can fetch balances and recent transactions.

## Operational tips

- All providers inherit the shared `BaseBankingProvider`, so rate limits and write caps are logged consistently.
- If a provider approaches 90% of its `maxWriteCents`, you will see a `banking-provider: credit approaching cap` warning in the logs. Create a follow-up ticket to raise the cap or split the transfers.
- For debugging Basiq responses, enable trace logging and run `curl "$BASIQ_API_URL/organisations/<orgId>/accounts" -H "Authorization: Bearer $BASIQ_API_KEY"` to reproduce the call outside the gateway.
