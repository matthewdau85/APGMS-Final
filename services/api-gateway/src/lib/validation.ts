// services/api-gateway/src/lib/validation.ts
import type { z } from "zod";

/**
 * Simple helper: parse a value with a Zod schema and return the typed data.
 * Throws ZodError on validation failure.
 *
 * This is used in routes like auth/payment-plans where we expect a valid body
 * and let the route handler deal with errors (usually by try/catch or Fastify's
 * error handling).
 */
export function parseWithSchema<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown,
): z.infer<TSchema> {
  return schema.parse(value);
}
