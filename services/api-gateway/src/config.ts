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

  // auth bits we actually use at runtime (these were in env before)
  readonly auth: {
    readonly audience: string;
    readonly issuer: string;
    readonly devSecret: string;
  };
  readonly regulator: {
    readonly accessCode: string;
    readonly jwtAudience: string;
    readonly sessionTtlMinutes: number;
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
  } catch {
    throw new Error(`${name} must contain valid JSON`);
  }
};

const ensureJwksConfigured = (): void => {
  const raw = envString("AUTH_JWKS");
  const parsed = parseJson<{ keys?: unknown }>(raw, "AUTH_JWKS");
  const schema = z
    .object({
      keys: z.array(jwksKeySchema).min(1),
    })
    .safeParse(parsed);
  if (!schema.success) {
    throw new Error(
      `AUTH_JWKS must contain at least one key with kid/alg: ${schema.error.message}`,
    );
  }
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

// This builds a config object from process.env with validation.
export function loadConfig(): AppConfig {
  // DB URLs
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

  // auth inputs must exist / be sane
  const audience = envString("AUTH_AUDIENCE");
  const issuer = envString("AUTH_ISSUER");
  const devSecret = envString("AUTH_DEV_SECRET");

  // we keep AUTH_JWKS sanity because original code expected it
  ensureJwksConfigured();

  // encryption/key material must exist / be sane
  const keySet = ensureKeyMaterial(
    envString("PII_KEYS"),
    "PII_KEYS",
  );
  const activeKid = envString("PII_ACTIVE_KEY");
  if (!keySet.some((entry) => entry.kid === activeKid)) {
    throw new Error(
      `PII_ACTIVE_KEY ${activeKid} does not exist in PII_KEYS`,
    );
  }

  const saltSet = ensureSaltMaterial(
    envString("PII_SALTS"),
    "PII_SALTS",
  );
  const activeSid = envString("PII_ACTIVE_SALT");
  if (!saltSet.some((entry) => entry.sid === activeSid)) {
    throw new Error(
      `PII_ACTIVE_SALT ${activeSid} does not exist in PII_SALTS`,
    );
  }

  // if we reached here, PII is valid
  const kmsKeysetLoaded = true;

  // rate limit config
  const rateLimitMax = parseIntegerEnv(
    "API_RATE_LIMIT_MAX",
    60,
  );
  const rateLimitWindow = (
    process.env.API_RATE_LIMIT_WINDOW ?? "1 minute"
  ).trim();
  if (rateLimitWindow.length === 0) {
    throw new Error(
      "API_RATE_LIMIT_WINDOW must not be empty",
    );
  }

  // auth brute force threshold
  const authFailureThreshold = parseIntegerEnv(
    "AUTH_FAILURE_THRESHOLD",
    5,
  );

  // tax-engine URL
  const taxEngineUrl = ensureUrl(
    process.env.TAX_ENGINE_URL?.trim() &&
      process.env.TAX_ENGINE_URL.trim().length > 0
      ? process.env.TAX_ENGINE_URL.trim()
      : "http://tax-engine:8000",
    "TAX_ENGINE_URL",
  );

  const regulatorAccessCode = envString("REGULATOR_ACCESS_CODE");
  const regulatorAudience =
    process.env.REGULATOR_JWT_AUDIENCE &&
    process.env.REGULATOR_JWT_AUDIENCE.trim().length > 0
      ? process.env.REGULATOR_JWT_AUDIENCE.trim()
      : "urn:apgms:regulator";
  const regulatorSessionTtl = parseIntegerEnv(
    "REGULATOR_SESSION_TTL_MINUTES",
    60,
  );

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
      allowedOrigins: splitOrigins(
        process.env.CORS_ALLOWED_ORIGINS,
      ),
    },
    taxEngineUrl,
    auth: {
      audience,
      issuer,
      devSecret,
    },
    regulator: {
      accessCode: regulatorAccessCode,
      jwtAudience: regulatorAudience,
      sessionTtlMinutes: regulatorSessionTtl,
    },
  };
}

// 🔥 THIS is what app.ts imports
export const config: AppConfig = loadConfig();
