# Logging Standard

## Format
- JSON logs emitted by Fastify/Pino. Each entry includes level, 	ime, msg, and eqId (Fastify request identifier).
- Request hooks attach x-request-id header with the same ID for end-to-end correlation (services/api-gateway/src/app.ts:204).
- Audit and security events append contextual objects (orgId, actorId, mode) for searchability (services/api-gateway/src/app.ts:268).

## Levels
- info: normal lifecycle messages (pi-gateway listening, audit successes).
- warn: anomalies like repeated auth failures, readiness flaps.
- error: failed shutdown, unhandled exceptions, audit persistence failures.

## Context
- Request scoped log fields: eqId, method, url, statusCode.
- Domain fields: orgId, principal, ction for audit logs.
- Security events use security_event structure in services/api-gateway/src/routes/admin.data.ts:74.

## Correlation
- Clients should propagate the x-request-id header; gateway reuses existing value when present (future work) or generates one via Fastify.
- Tracing spans emit OpenTelemetry 	race_id and span_id enabling distributed tracing integration.

## Retention & Shipping
- Logs are structured and ready for shipping to ELK/Datadog/Splunk.
- Ensure downstream log pipeline preserves JSON (no line wrapping).

## Validation
- Run local requests and verify logs contain eqId and JSON structure: pnpm --filter @apgms/api-gateway dev followed by curl http://localhost:3000/health.
- Security events can be located via security_event key in logs.
