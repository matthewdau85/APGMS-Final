// services/api-gateway/src/config.ts

import { Buffer } from "node:buffer";
import { URL } from "node:url";
import { z } from "zod";

export interface AppConfig {
  readonly databaseUrl: string;
  readonly shadowDatabaseUrl?: string;

  readonly rateLimit: {
    readonly max: number;
    readonly window: string;
  };

  readonly security: {
    readonly authFailureThreshold: number;
    readonly kmsKeysetLoaded?: boolean;
  };

  readonly cors: {
    readonly allowedOrigins: string[];
  };

  readonly taxEngineUrl: string;

  readonly auth: {
    readonly audience: string;
    readonly issuer: string;
    readonly devSecret: string;
    readonly jwks: {
      keys: Array<{
        kid: string;
        alg: string;
      }>;
    };
  };

  readonly pii: {
    readonly keys: Array<{ kid: string; material: string }>;
    readonly activeKid: string;
    readonly salts: Array<{ sid: string; secret: string }>;
    readonly activeSid: string;
  };
}

const base64Regex = /^[A-Za-z0-9+/=]+$/;

const jwksKeySchema = z.object({
  kid: z.string().min(1),
  alg: z.string().min(1),
});

const envString = (name: string): string => {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
};

const parseIntegerEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
};

const ensureUrl = (value: string, name: string): string => {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return value;
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
};

const parseJson = <T>(value: string, name: string): T => {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`${name} must contain valid JSON`);
  }
};

const parseJwks = (): { keys: Array<{ kid: string; alg: string }> } => {
  const raw = envString("AUTH_JWKS");
  const parsed = parseJson<{ keys?: unknown }>(raw, "AUTH_JWKS");

  const result = z
    .object({
      keys: z.array(jwksKeySchema).min(1),
    })
    .safeParse(parsed);

  if (!result.success) {
    throw new Error(
      `AUTH_JWKS must contain at least one key with kid/alg: ${result.error.message}`,
    );
  }

  return {
    keys: result.data.keys.map((k) => ({
      kid: k.kid,
      alg: k.alg,
    })),
  };
};

const ensureKeyMaterial = (
  value: string,
  name: string,
): Array<{ kid: string; material: string }> => {
  const parsed = parseJson<Array<{ kid?: unknown; material?: unknown }>>(
    value,
    name,
  );
  const schema = z
    .array(
      z.object({
        kid: z.string().min(1),
        material: z
          .string()
          .regex(base64Regex, "expected base64 material")
          .refine(
            (material) => Buffer.from(material, "base64").length === 32,
            {
              message: "material must decode to 32 bytes",
            },
          ),
      }),
    )
    .min(1);

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`${name} invalid: ${result.error.message}`);
  }
  return result.data;
};

const ensureSaltMaterial = (
  value: string,
  name: string,
): Array<{ sid: string; secret: string }> => {
  const parsed = parseJson<Array<{ sid?: unknown; secret?: unknown }>>(
    value,
    name,
  );
  const schema = z
    .array(
      z.object({
        sid: z.string().min(1),
        secret: z
          .string()
          .regex(base64Regex, "expected base64 secret")
          .refine(
            (secret) => Buffer.from(secret, "base64").length === 32,
            {
              message: "secret must decode to 32 bytes",
            },
          ),
      }),
    )
    .min(1);

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`${name} invalid: ${result.error.message}`);
  }
  return result.data;
};

const splitOrigins = (raw: string | undefined): string[] => {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

export function loadConfig(): AppConfig {
  //
  // DATABASE
  //
  const databaseUrl = ensureUrl(
    envString("DATABASE_URL"),
    "DATABASE_URL",
  );

  const shadowDatabaseUrlRaw = process.env.SHADOW_DATABASE_URL;
  const shadowDatabaseUrl =
    shadowDatabaseUrlRaw && shadowDatabaseUrlRaw.trim().length > 0
      ? ensureUrl(
          shadowDatabaseUrlRaw.trim(),
          "SHADOW_DATABASE_URL",
        )
      : undefined;

  //
  // AUTH
  //
  const authAudience = envString("AUTH_AUDIENCE");
  const authIssuer = ensureUrl(envString("AUTH_ISSUER"), "AUTH_ISSUER");

  // New: local symmetric secret for HS256 signing/verification in dev
  const authDevSecret = envString("AUTH_DEV_SECRET");
  if (authDevSecret.length < 16) {
    // just basic sanity so nobody accidentally leaves it super short
    throw new Error("AUTH_DEV_SECRET must be at least 16 characters");
  }

  // Existing: JWKS (still validated because other parts of the code expect it)
  const jwks = parseJwks();

  //
  // PII / encryption materials
  //
  const piiKeys = ensureKeyMaterial(envString("PII_KEYS"), "PII_KEYS");
  const piiActiveKid = envString("PII_ACTIVE_KEY");
  if (!piiKeys.some((entry) => entry.kid === piiActiveKid)) {
    throw new Error(
      `PII_ACTIVE_KEY ${piiActiveKid} does not exist in PII_KEYS`,
    );
  }

  const piiSalts = ensureSaltMaterial(envString("PII_SALTS"), "PII_SALTS");
  const piiActiveSid = envString("PII_ACTIVE_SALT");
  if (!piiSalts.some((entry) => entry.sid === piiActiveSid)) {
    throw new Error(
      `PII_ACTIVE_SALT ${piiActiveSid} does not exist in PII_SALTS`,
    );
  }

  // we got this far => crypto keyset is loaded
  const kmsKeysetLoaded = true;

  //
  // RATE LIMIT / SECURITY
  //
  const rateLimitMax = parseIntegerEnv("API_RATE_LIMIT_MAX", 60);
  const rateLimitWindow = (
    process.env.API_RATE_LIMIT_WINDOW ?? "1 minute"
  ).trim();
  if (rateLimitWindow.length === 0) {
    throw new Error("API_RATE_LIMIT_WINDOW must not be empty");
  }

  const authFailureThreshold = parseIntegerEnv(
    "AUTH_FAILURE_THRESHOLD",
    5,
  );

  //
  // CORS
  //
  const allowedOrigins = splitOrigins(
    process.env.CORS_ALLOWED_ORIGINS,
  );

  //
  // TAX ENGINE
  //
  const taxEngineUrl = ensureUrl(
    process.env.TAX_ENGINE_URL?.trim() &&
      process.env.TAX_ENGINE_URL.trim().length > 0
      ? process.env.TAX_ENGINE_URL.trim()
      : "http://tax-engine:8000",
    "TAX_ENGINE_URL",
  );

  //
  // FINAL SHAPE
  //
  return {
    databaseUrl,
    shadowDatabaseUrl,

    rateLimit: {
      max: rateLimitMax,
      window: rateLimitWindow,
    },

    security: {
      authFailureThreshold,
      kmsKeysetLoaded,
    },

    cors: {
      allowedOrigins,
    },

    taxEngineUrl,

    auth: {
      audience: authAudience,
      issuer: authIssuer,
      devSecret: authDevSecret,
      jwks,
    },

    pii: {
      keys: piiKeys,
      activeKid: piiActiveKid,
      salts: piiSalts,
      activeSid: piiActiveSid,
    },
  };
}
