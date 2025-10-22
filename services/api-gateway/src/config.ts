import { createPublicKey, type KeyObject } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

const AdminAuthEnvSchema = z
  .object({
    ADMIN_JWT_AUDIENCE: z.string().min(1, "ADMIN_JWT_AUDIENCE is required"),
    ADMIN_JWT_ISSUER: z.string().min(1, "ADMIN_JWT_ISSUER is required"),
    ADMIN_JWT_ALGORITHM: z
      .enum(["RS256", "HS256"], {
        errorMap: () => ({ message: "ADMIN_JWT_ALGORITHM must be RS256 or HS256" }),
      })
      .default("RS256"),
    ADMIN_JWT_PUBLIC_KEY_FILE: z.string().optional(),
    ADMIN_JWT_SECRET_FILE: z.string().optional(),
    ADMIN_JWT_SECRET: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const { ADMIN_JWT_ALGORITHM: algorithm } = value;
    if (algorithm === "RS256") {
      if (!value.ADMIN_JWT_PUBLIC_KEY_FILE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ADMIN_JWT_PUBLIC_KEY_FILE is required when ADMIN_JWT_ALGORITHM=RS256",
          path: ["ADMIN_JWT_PUBLIC_KEY_FILE"],
        });
      }
      if (value.ADMIN_JWT_SECRET || value.ADMIN_JWT_SECRET_FILE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ADMIN_JWT_SECRET(_FILE) should not be provided for RS256",
          path: ["ADMIN_JWT_SECRET"],
        });
      }
    } else if (algorithm === "HS256") {
      if (!value.ADMIN_JWT_SECRET && !value.ADMIN_JWT_SECRET_FILE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ADMIN_JWT_SECRET or ADMIN_JWT_SECRET_FILE is required when ADMIN_JWT_ALGORITHM=HS256",
          path: ["ADMIN_JWT_SECRET"],
        });
      }
      if (value.ADMIN_JWT_PUBLIC_KEY_FILE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ADMIN_JWT_PUBLIC_KEY_FILE should not be provided for HS256",
          path: ["ADMIN_JWT_PUBLIC_KEY_FILE"],
        });
      }
    }
  });

export type AdminAuthConfig = {
  audience: string;
  issuer: string;
  algorithm: "RS256" | "HS256";
  key: KeyObject | Uint8Array;
};

let cachedAdminAuthConfig: AdminAuthConfig | null = null;

function loadCredentialFromFile(filename: string): string {
  const resolved = path.isAbsolute(filename)
    ? filename
    : path.join(process.cwd(), filename);
  return readFileSync(resolved, "utf8");
}

function getKeyMaterial(env: z.infer<typeof AdminAuthEnvSchema>): KeyObject | Uint8Array {
  if (env.ADMIN_JWT_ALGORITHM === "RS256") {
    const fileContents = loadCredentialFromFile(env.ADMIN_JWT_PUBLIC_KEY_FILE!);
    return createPublicKey(fileContents);
  }

  if (env.ADMIN_JWT_SECRET_FILE) {
    const secret = loadCredentialFromFile(env.ADMIN_JWT_SECRET_FILE);
    return new TextEncoder().encode(secret.trim());
  }

  return new TextEncoder().encode(env.ADMIN_JWT_SECRET!);
}

export function getAdminAuthConfig(): AdminAuthConfig {
  if (cachedAdminAuthConfig) {
    return cachedAdminAuthConfig;
  }

  const parsed = AdminAuthEnvSchema.parse(process.env);
  cachedAdminAuthConfig = {
    audience: parsed.ADMIN_JWT_AUDIENCE,
    issuer: parsed.ADMIN_JWT_ISSUER,
    algorithm: parsed.ADMIN_JWT_ALGORITHM,
    key: getKeyMaterial(parsed),
  };

  return cachedAdminAuthConfig;
}

export function __resetAdminAuthConfigForTests(): void {
  cachedAdminAuthConfig = null;
}
