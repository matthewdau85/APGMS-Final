// services/api-gateway/src/errors.ts

// Local lightweight HttpError helpers (still available if anything uses them)
export class HttpError extends Error {
  statusCode: number;
  code?: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function badRequest(message: string, code = "bad_request") {
  return new HttpError(400, message, code);
}

export function unauthorized(message = "Unauthorized", code = "unauthorized") {
  return new HttpError(401, message, code);
}

export function notFound(message = "Not found", code = "not_found") {
  return new HttpError(404, message, code);
}

export function internalError(
  message = "Internal server error",
  code = "internal_error",
) {
  return new HttpError(500, message, code);
}

// Bridge: expose the shared AppError class so route modules importing ../errors.js
// get the same AppError used by app.ts's global error handler.
export { AppError } from "@apgms/shared";
