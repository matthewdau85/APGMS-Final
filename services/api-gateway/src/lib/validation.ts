// services/api-gateway/src/lib/validation.ts
import { validationError } from "@apgms/shared";
import { type z, ZodError } from "zod";

/**
 * Parse a value with a Zod schema and surface a structured AppError when
 * validation fails. This lets route handlers (or the global error handler)
 * render a consistent 400 payload with field-level details.
 */
export function parseWithSchema<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown,
): z.infer<TSchema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw validationError(parsed.error as ZodError);
  }
  return parsed.data;
}
