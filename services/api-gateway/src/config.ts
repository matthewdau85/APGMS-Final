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
    readonly kmsKeysetLoaded?: boolean; // 👈 added
  };
  readonly cors: {
    readonly allowedOrigins: string[];
  };
  readonly taxEngineUrl: string;
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

export function loadConfig(): AppConfig {
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
  envString("AUTH_AUDIENCE");
  envString("AUTH_ISSUER");
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

  // if we reached here, we successfully parsed keys + salts
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

  // anomaly threshold for auth failures
  const authFailureThreshold = parseIntegerEnv(
    "AUTH_FAILURE_THRESHOLD",
    5,
  );

  // tax engine URL (used by api-gateway to call tax-engine container)
  const taxEngineUrl = ensureUrl(
    process.env.TAX_ENGINE_URL?.trim() &&
      process.env.TAX_ENGINE_URL.trim().length > 0
      ? process.env.TAX_ENGINE_URL.trim()
      : "http://tax-engine:8000",
    "TAX_ENGINE_URL",
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
      kmsKeysetLoaded, // 👈 now present for createApp() to enforce in prod
    },
    cors: {
      allowedOrigins: splitOrigins(
        process.env.CORS_ALLOWED_ORIGINS,
      ),
    },
    taxEngineUrl,
  };
}
