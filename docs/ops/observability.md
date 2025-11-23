# Observability

## Request correlation

Each incoming request is assigned a `x-request-id` (or honours the one provided
by the caller). The gateway echoes this header in responses, binds it to all
route logs, and adds it to the active OpenTelemetry span and baggage so traces
and downstream services can correlate work with the same value.

To trace or debug an interaction:

1. Capture the `x-request-id` from the response headers.
2. Query traces using the `request.id` attribute (e.g. `request.id = "<id>"`).
3. Filter structured logs for the `requestId` field to view the timeline of the
   request across handlers.

Use the same ID across trace and log stores to pivot between telemetry sources.
