// services/api-gateway/src/lib/validation.ts
import type { FastifyReply } from "fastify";
import type { z } from "zod";
import { ZodError, type ZodTypeAny } from "zod";

type ValidationDetail = { path: string; message: string };

const formatValidationDetails = (error: ZodError): ValidationDetail[] =>
  error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));

const respondWithValidationError = (reply: FastifyReply, error: ZodError) => {
  reply.code(400).send({
    error: {
      code: "invalid_payload",
      message: "Validation failed",
      details: formatValidationDetails(error),
    },
  });
};

/**
 * Simple helper: parse a value with a Zod schema and return the typed data.
 * Throws ZodError on validation failure.
 *
 * This is used in routes like auth/payment-plans where we expect a valid body
 * and let the route handler deal with errors (usually by try/catch or Fastify's
 * error handling).
 */
export function parseWithSchema<TSchema extends ZodTypeAny>(
  schema: TSchema,
  value: unknown,
): z.infer<TSchema> {
  return schema.parse(value);
}

export function validateWithReply<TSchema extends ZodTypeAny>(
  schema: TSchema,
  value: unknown,
  reply: FastifyReply,
): z.infer<TSchema> | null {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  respondWithValidationError(reply, result.error);
  return null;
}
