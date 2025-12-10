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
export interface RequestContext {
    id?: string;
    headers?: Record<string, string | string[] | undefined>;
}
export declare function buildSecurityContextFromRequest(request?: RequestContext): SecurityLogContext;
export type SecurityLogger = (entry: SecurityLogEntry) => Promise<void> | void;
export declare function buildSecurityLogEntry(payload: SecurityLogPayload, context?: SecurityLogContext): SecurityLogEntry;
export declare function logSecurityEvent(logger: {
    info: (payload: unknown, message?: string) => void;
}, entry: SecurityLogEntry): void;
//# sourceMappingURL=security-log.d.ts.map