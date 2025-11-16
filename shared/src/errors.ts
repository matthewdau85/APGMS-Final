import type { ZodError, ZodIssue } from "zod";

export type FieldError = {
  path: string;
  message: string;
};

export type AppErrorMetadata = Record<string, unknown> & {
  severity?: string;
  retryable?: boolean;
  domain?: string;
  remediation?: string;
};

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: FieldError[];
  readonly metadata?: AppErrorMetadata;

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: FieldError[],
    metadata?: AppErrorMetadata,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.metadata = metadata;
  }
}

const toFieldErrors = (issues: readonly ZodIssue[]): FieldError[] =>
  issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));

export const createError = (
  status: number,
  code: string,
  message: string,
  fields?: FieldError[],
  metadata?: AppErrorMetadata,
): AppError => new AppError(status, code, message, fields, metadata);

export const badRequest = (code: string, message: string, fields?: FieldError[]): AppError =>
  createError(400, code, message, fields);

export const unauthorized = (code: string, message: string): AppError =>
  createError(401, code, message);

export const forbidden = (code: string, message: string): AppError =>
  createError(403, code, message);

export const notFound = (code: string, message: string): AppError =>
  createError(404, code, message);

export const conflict = (code: string, message: string): AppError =>
  createError(409, code, message);

export const validationError = (error: ZodError | FieldError[]): AppError => {
  if (Array.isArray(error)) {
    return badRequest("invalid_body", "Validation failed", error);
  }
  return badRequest("invalid_body", "Validation failed", toFieldErrors(error.issues));
};
