// services/api-gateway/src/lib/errors.ts

/**
 * Centralised error messages used across the API gateway.
 *
 * NOTE:
 * We export both UPPER_SNAKE keys and the existing lower_snake keys
 * so older call sites like ERROR_MESSAGES.cors_forbidden still type-check.
 */
export const ERROR_MESSAGES = {
  INTERNAL: "Internal server error",
  BAD_REQUEST: "Bad request",
  NOT_FOUND: "Not found",

  // CORS & legacy keys
  CORS_FORBIDDEN: "CORS origin not allowed",
  INTERNAL_ERROR: "Internal server error",

  // Backwards-compatible lower_snake aliases used in app.ts
  cors_forbidden: "CORS origin not allowed",
  internal_error: "Internal server error",
} as const;

/**
 * Simple domain error type that can be safely mapped to HTTP responses.
 */
export class DomainError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly details?: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(code: string, message: string, statusCode = 500, details?: any) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function internalError(
  message: string = ERROR_MESSAGES.INTERNAL,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any,
): DomainError {
  return new DomainError("internal_error", message, 500, details);
}

export function badRequest(
  message: string = ERROR_MESSAGES.BAD_REQUEST,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any,
): DomainError {
  return new DomainError("bad_request", message, 400, details);
}

export function notFound(
  message: string = ERROR_MESSAGES.NOT_FOUND,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any,
): DomainError {
  return new DomainError("not_found", message, 404, details);
}

/**
 * Normalise any thrown value into an HTTP-friendly shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toHttpError(err: any): {
  statusCode: number;
  body: { code: string; message: string; details?: any };
} {
  if (err instanceof DomainError) {
    return {
      statusCode: err.statusCode,
      body: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    };
  }

  const statusCode =
    typeof err?.statusCode === "number" ? err.statusCode : 500;
  const code = typeof err?.code === "string" ? err.code : "internal_error";
  const message =
    typeof err?.message === "string"
      ? err.message
      : ERROR_MESSAGES.INTERNAL;

  return {
    statusCode,
    body: {
      code,
      message,
    },
  };
}
