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
// ---------- PII redaction: TFN / ABN / bank account ------------------------
const SENSITIVE_KEYS = new Set(["tfn", "abn", "bankAccountNumber"]);
function redactValue(key, value) {
    if (!SENSITIVE_KEYS.has(key))
        return value;
    if (typeof value === "string" && value.length > 0) {
        return "***redacted***";
    }
    return "***redacted***";
}
function redactPayload(payload) {
    if (!payload)
        return payload;
    const result = {};
    for (const [key, value] of Object.entries(payload)) {
        result[key] = redactValue(key, value);
    }
    return result;
}
function redactSecurityEntry(entry) {
    const redactedMetadata = redactPayload(entry.metadata);
    if (!redactedMetadata || redactedMetadata === entry.metadata) {
        return entry;
    }
    return {
        ...entry,
        metadata: redactedMetadata,
    };
}
// ---------- Entry construction + logging -----------------------------------
export function buildSecurityLogEntry(payload, context = {}) {
    const mergedMetadata = context.metadata
        ? Object.assign({}, payload.metadata ?? {}, context.metadata)
        : payload.metadata;
    const rawEntry = {
        ...payload,
        metadata: mergedMetadata,
        correlationId: context.correlationId ?? payload.correlationId,
        requestId: context.requestId ?? payload.requestId,
        occurredAt: payload.occurredAt ?? new Date().toISOString(),
    };
    const safeEntry = safeLogAttributes(rawEntry);
    return redactSecurityEntry(safeEntry);
}
export function logSecurityEvent(logger, entry) {
    logger.info({ security: entry }, "security_event");
}
//# sourceMappingURL=security-log.js.map