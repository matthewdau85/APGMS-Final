type RecordAuditLogParams = {
    orgId: string;
    actorId: string;
    action: string;
    metadata?: unknown | null;
    throwOnError?: boolean;
    timestamp?: Date;
};
export declare function recordAuditLog({ orgId, actorId, action, metadata, throwOnError, timestamp, }: RecordAuditLogParams): Promise<void>;
export declare function recordCriticalAuditLog(params: Omit<RecordAuditLogParams, "throwOnError">): Promise<void>;
export {};
//# sourceMappingURL=audit.d.ts.map