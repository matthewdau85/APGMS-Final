import { safeLogAttributes } from "./logging.js";

export type SecurityLogMode =
  | "anonymized"
  | "deleted"
  | "exported"
  | "deleted_export"
  | "data_retention";

export interface SecurityLogPayload {
  event: string;
  orgId: string;
  principal: string;
  subjectUserId?: string;
  subjectEmail?: string;
  mode?: SecurityLogMode;
  metadata?: Record<string, unknown>;
  correlationId?: string;
  requestId?: string | number;
  occurredAt?: string;
}

export interface SecurityLogContext {
  correlationId?: string;
  requestId?: string | number;
  metadata?: Record<string, unknown>;
}

export interface SecurityLogEntry extends SecurityLogPayload {
  correlationId?: string;
  requestId?: string | number;
  occurredAt: string;
}

const CORRELATION_HEADERS = ["x-correlation-id", "X-Correlation-Id"];

function extractCorrelationFromHeaders(
  headers: Record<string, string | string[] | undefined> | undefined
): string | undefined {
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

export interface RequestContext {
  id?: string;
  headers?: Record<string, string | string[] | undefined>;
}

export function buildSecurityContextFromRequest(
  request?: RequestContext
): SecurityLogContext {
  const correlationId = extractCorrelationFromHeaders(request?.headers);
  return {
    correlationId,
    requestId: request?.id,
  };
}

export type SecurityLogger = (entry: SecurityLogEntry) => Promise<void> | void;

// ---------- PII redaction: TFN / ABN / bank account ------------------------

const SENSITIVE_KEYS = new Set(["tfn", "abn", "bankAccountNumber"]);

function redactValue(key: string, value: unknown): unknown {
  if (!SENSITIVE_KEYS.has(key)) return value;

  if (typeof value === "string" && value.length > 0) {
    return "***redacted***";
  }

  return "***redacted***";
}

function redactPayload(
  payload: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!payload) return payload;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    result[key] = redactValue(key, value);
  }
  return result;
}

function redactSecurityEntry(entry: SecurityLogEntry): SecurityLogEntry {
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

export function buildSecurityLogEntry(
  payload: SecurityLogPayload,
  context: SecurityLogContext = {}
): SecurityLogEntry {
  const mergedMetadata = context.metadata
    ? Object.assign({}, payload.metadata ?? {}, context.metadata)
    : payload.metadata;

  const rawEntry: SecurityLogEntry = {
    ...payload,
    metadata: mergedMetadata,
    correlationId: context.correlationId ?? payload.correlationId,
    requestId: context.requestId ?? payload.requestId,
    occurredAt: payload.occurredAt ?? new Date().toISOString(),
  };

  const safeEntry = safeLogAttributes(rawEntry) as SecurityLogEntry;
  return redactSecurityEntry(safeEntry);
}

export function logSecurityEvent(
  logger: { info: (payload: unknown, message?: string) => void },
  entry: SecurityLogEntry
): void {
  logger.info({ security: entry }, "security_event");
}
