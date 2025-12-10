/**
 * Centralised error messages used across the API gateway.
 *
 * NOTE:
 * We export both UPPER_SNAKE keys and the existing lower_snake keys
 * so older call sites like ERROR_MESSAGES.cors_forbidden still type-check.
 */
export declare const ERROR_MESSAGES: {
    readonly INTERNAL: "Internal server error";
    readonly BAD_REQUEST: "Bad request";
    readonly NOT_FOUND: "Not found";
    readonly CORS_FORBIDDEN: "CORS origin not allowed";
    readonly INTERNAL_ERROR: "Internal server error";
    readonly cors_forbidden: "CORS origin not allowed";
    readonly internal_error: "Internal server error";
};
/**
 * Simple domain error type that can be safely mapped to HTTP responses.
 */
export declare class DomainError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly details?: any;
    constructor(code: string, message: string, statusCode?: number, details?: any);
}
export declare function internalError(message?: string, details?: any): DomainError;
export declare function badRequest(message?: string, details?: any): DomainError;
export declare function notFound(message?: string, details?: any): DomainError;
/**
 * Normalise any thrown value into an HTTP-friendly shape.
 */
export declare function toHttpError(err: any): {
    statusCode: number;
    body: {
        code: string;
        message: string;
        details?: any;
    };
};
//# sourceMappingURL=errors.d.ts.map