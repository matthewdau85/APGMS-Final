export interface RetryOptions {
    readonly maxAttempts?: number;
    readonly initialDelayMs?: number;
    readonly maxDelayMs?: number;
    readonly jitter?: boolean;
    readonly retriable?: (error: unknown) => boolean;
}
/**
 * Generic async retry with exponential backoff.
 */
export declare function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
//# sourceMappingURL=retry.d.ts.map