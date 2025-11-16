import { safeLogAttributes } from "./logging.js";

export type SecurityLogMode = "anonymized" | "deleted" | "exported" | "deleted_export" | "data_retention";

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
  headers: Record<string, string | string[] | undefined> | undefined,
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

export function buildSecurityContextFromRequest(request?: RequestContext): SecurityLogContext {
  const correlationId = extractCorrelationFromHeaders(request?.headers);
  return {
    correlationId,
    requestId: request?.id,
  };
}

export type SecurityLogger = (entry: SecurityLogEntry) => Promise<void> | void;

export function buildSecurityLogEntry(
  payload: SecurityLogPayload,
  context: SecurityLogContext = {},
): SecurityLogEntry {
  const mergedMetadata = context.metadata
    ? Object.assign({}, payload.metadata ?? {}, context.metadata)
    : payload.metadata;
  const entry: SecurityLogEntry = {
    ...payload,
    metadata: mergedMetadata,
    correlationId: context.correlationId ?? payload.correlationId,
    requestId: context.requestId ?? payload.requestId,
    occurredAt: payload.occurredAt ?? new Date().toISOString(),
  };
  return safeLogAttributes(entry) as SecurityLogEntry;
}

export function logSecurityEvent(logger: { info: (payload: unknown, message?: string) => void }, entry: SecurityLogEntry) {
  logger.info({ security: entry }, "security_event");
}
