# POS + software provider ingestion guide (APGMS)

## Versioning and payload contract
- The ingestion endpoint is `/api/ingestion/v1/ledger-events` and only accepts `schemaVersion` `apgms.ingestion.invoice-settlement.v1`. Requests with other versions are rejected to prevent drift.
- JSON Schema: `services/api-gateway/src/schemas/invoice-settlement.ingestion.schema.json`.
- OpenAPI: `services/api-gateway/src/schemas/invoice-settlement.ingestion.openapi.json`.
- GST classification is deterministic. The response includes `classificationHash` (SHA-256 over the GST/non-GST buckets) and the immutable ledger `ledgerId` (IntegrationEvent.id) that must be quoted in evidence packs.

## Replay and idempotency
- Every ingestion call must include an `Idempotency-Key` header. If omitted, the API derives a payload hash and will return HTTP 409 on replays.
- Partners should replay with the same key when retrying network failures. Changing the payload with the same key will be rejected.
- Ledger evidence uses `ledgerId` and partner-supplied `ledgerRef` to anchor audit trails; these IDs are immutable.

## Consent, privacy, and RPT display
- The POS must display APGMS consent text to the end-user and send the `consent.reference`, `consent.capturedAt`, and `consent.displayedToUser` flags.
- The request must also carry the `rptReference` (`RPT-XXXXXX…`) issued at the point of consent. Both values are persisted alongside the ledger event for audit.
- Do not send payloads unless consent was displayed; submissions without the flag will be rejected by schema validation.

## Signature and webhook replay rules
- Calculate an HMAC-SHA256 over the canonical JSON payload and send it in `x-payload-signature` (hex). The same signature is echoed in the ledger metadata for tamper evidence.
- Webhooks from APGMS to partners must implement exponential backoff retries (e.g., 1s, 2s, 4s, 8s, capped at 5 minutes) and must include the immutable `ledgerId` so you can dedupe.

## Settlement/GST documentation
- The ingestion payload requires both invoice and settlement references. GST and non-GST totals are derived from line-level `gstCode` values and written to the ledger with their classification hash.
- Partners should store the returned `classificationHash` next to their receipt print/export so reconciliation always points back to the same immutable ledger evidence.