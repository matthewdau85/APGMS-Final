# Payments Runbook

## Configuration

| Variable | Description |
| --- | --- |
| `BANKING_PROVIDER_ID` | Identifier of the configured designated banking provider (`mock`, `cba`, `nab`, `anz`). |
| `BANKING_API_BASE_URL` | Base URL for the upstream banking API used by the payments service factories. |
| `BANKING_API_KEY` | Bearer token that authenticates the payments service with the upstream API. |
| `BANKING_API_TIMEOUT_MS` | Timeout, in milliseconds, for outbound banking HTTP calls. |

`apps/api/src/config/index.ts` validates these values during boot so the API fails fast if a key or URL is missing.

## Provider wiring

1. Load the config via `import { config } from "@apgms/api/src/config"` (or call `loadConfig`).
2. Create a provider using `createConfiguredBankingProvider({ config: config.banking })` from `@apgms/payments`.
3. Pass the provider, Prisma client, and optional audit logger into `createPaymentsService` to obtain the domain-level APIs.

This ensures dependency injection and makes it trivial to swap providers in tests.

## Testing and VCR fixtures

Run the dedicated suite with:

```
pnpm --filter @apgms/payments test
```

This command executes the files in `tests/services/payments`. The `contract/cba-provider.contract.test.ts` test spins up a mock server that replays the JSON fixtures in `tests/services/payments/fixtures`. These fixtures act as lightweight VCR recordings of the upstream sandbox contract so we can detect breaking API changes without hitting production.

## Incident response

* When API credit attempts begin timing out, bump `BANKING_API_TIMEOUT_MS` only after verifying latency with the bank. Long-term, capture metrics from the payments service to spot trends.
* Any `banking_api_error` indicates the upstream returned a non-2xx response. Use the recorded fixture structure to compare the failing payload and confirm whether the issue is data-related or a contract change.
* Update the fixtures whenever the banking partner revs their schema—commit both the new fixture files and an explanation here.
