import type { FastifyHelmetOptions } from "@fastify/helmet";
import type { AppConfig } from "./config.js";

export type CspDirectives = Record<string, string[]>;

/**
 * Build a CSP directives object from config.
 * - Safe when config.cors or allowedOrigins is missing (defaults to "*")
 *
 * NOTE: This helper is currently unused by helmetConfigFor,
 * but is left intact for future use.
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

export function helmetConfigFor(cfg: Partial<AppConfig>): FastifyHelmetOptions {
  const allowedOrigins = (cfg?.cors?.allowedOrigins ?? []) as string[];

  return {
    frameguard: { action: "deny" as const },
    referrerPolicy: { policy: "no-referrer" as const },
    crossOriginResourcePolicy: { policy: "same-site" as const },

    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        connectSrc: ["'self'", ...allowedOrigins],
        upgradeInsecureRequests: [],
      },
    },
  };
}
