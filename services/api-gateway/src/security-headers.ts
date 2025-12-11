// src/security-headers.ts
import type { FastifyHelmetOptions } from "@fastify/helmet";
import type { AppConfig } from "./config.js";

export type CspDirectives = Record<string, string[]>;

/**
 * Build a CSP directives object from config.
 * - Safe when config.cors or allowedOrigins is missing (defaults to "*")
 */
function buildCsp(config: Partial<AppConfig>): CspDirectives {
  const allowedOrigins =
    config.cors?.allowedOrigins && config.cors.allowedOrigins.length > 0
      ? config.cors.allowedOrigins
      : ["*"];

  const connectSrc = ["'self'", ...allowedOrigins];

  return {
    "default-src": ["'self'"],
    "connect-src": connectSrc,
    "script-src": ["'self'", "'unsafe-inline'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "frame-ancestors": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
}

/**
 * Helmet configuration derived from AppConfig.
 *
 * - In production/staging, enable CSP with directives from config.
 * - In test/local/dev, leave Helmet on but disable CSP (simpler tests, no crashes).
 */
export function helmetConfigFor(
  config: Partial<AppConfig>,
): FastifyHelmetOptions {
  const env = (config as any).env ?? process.env.NODE_ENV ?? "test";
  const enableCsp = env === "production" || env === "staging";

  if (!enableCsp) {
    return {
      contentSecurityPolicy: false,
    };
  }

  return {
    contentSecurityPolicy: {
      directives: buildCsp(config),
    },
  };
}
