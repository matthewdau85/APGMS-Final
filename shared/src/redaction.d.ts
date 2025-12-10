export declare function redactValue<T>(input: T): T;
export declare function redactObject<T extends Record<string, unknown>>(input: T): T;
export declare function redactError(err: unknown): Record<string, unknown>;
export declare function redactLogPayload(payload: unknown): unknown;
//# sourceMappingURL=redaction.d.ts.map