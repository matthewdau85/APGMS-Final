import type { ZodTypeAny } from "zod";
import { validationError } from "@apgms/shared";

export const parseWithSchema = <Schema extends ZodTypeAny>(
  schema: Schema,
  payload: unknown,
): Schema["_output"] => {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw validationError(result.error);
  }
  return result.data;
};
