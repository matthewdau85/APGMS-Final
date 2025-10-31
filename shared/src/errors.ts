import { ZodError, ZodIssue } from "zod";

export type FieldError = {
  path: string;
  message: string;
};

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: FieldError[];

  constructor(status: number, code: string, message: string, fields?: FieldError[]) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.fields = fields;
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
): AppError => new AppError(status, code, message, fields);

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
