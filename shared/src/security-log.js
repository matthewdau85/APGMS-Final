import { safeLogAttributes } from "./logging.js";
const CORRELATION_HEADERS = ["x-correlation-id", "X-Correlation-Id"];
function extractCorrelationFromHeaders(headers) {
    if (!headers) {
        return undefined;
    }
    for (const headerName of CORRELATION_HEADERS) {
        const raw = headers[headerName];
        if (typeof raw === "string") {
            return raw.trim() || undefined;
        }
        if (Array.isArray(raw) && raw.length > 0) {
            return raw[0]?.trim() || undefined;
        }
    }
    return undefined;
}
export function buildSecurityContextFromRequest(request) {
    const correlationId = extractCorrelationFromHeaders(request?.headers);
    return {
        correlationId,
        requestId: request?.id,
    };
}
export function buildSecurityLogEntry(payload, context = {}) {
    const mergedMetadata = context.metadata
        ? Object.assign({}, payload.metadata ?? {}, context.metadata)
        : payload.metadata;
    const entry = {
        ...payload,
        metadata: mergedMetadata,
        correlationId: context.correlationId ?? payload.correlationId,
        requestId: context.requestId ?? payload.requestId,
        occurredAt: payload.occurredAt ?? new Date().toISOString(),
    };
    return safeLogAttributes(entry);
}
export function logSecurityEvent(logger, entry) {
    logger.info({ security: entry }, "security_event");
}
