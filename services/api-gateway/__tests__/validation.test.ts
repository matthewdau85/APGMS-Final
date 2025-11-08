import { describe, expect, it } from "@jest/globals";
import { z } from "zod";

import { AppError } from "@apgms/shared";
import { parseWithSchema } from "../src/lib/validation.js";

describe("parseWithSchema", () => {
  it("returns the parsed payload when validation succeeds", () => {
    const schema = z.object({
      orgId: z.string().uuid(),
      amount: z.number().int().nonnegative(),
    });

    const result = parseWithSchema(schema, {
      orgId: "5fd1764f-5cef-4d19-8e25-a8247a44fb0d",
      amount: 42,
    });

    expect(result).toEqual({
      orgId: "5fd1764f-5cef-4d19-8e25-a8247a44fb0d",
      amount: 42,
    });
  });

  it("throws an AppError with field details when validation fails", () => {
    const schema = z.object({
      email: z.string().email(),
      amount: z.number().positive(),
    });

    try {
      parseWithSchema(schema, {
        email: "invalid-email",
        amount: -10,
      });
      throw new Error("expected parseWithSchema to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe("invalid_body");
      expect(appError.status).toBe(400);
      expect(appError.fields).toEqual([
        { path: "email", message: expect.stringContaining("email") },
        { path: "amount", message: expect.stringContaining(">0") },
      ]);
    }
  });
});
