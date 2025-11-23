import type { FastifyHelmetOptions } from "@fastify/helmet";
import type { AppConfig } from "./config.js";

/**
 * Extracted helmet configuration to keep security policy testable.
 */
export function helmetConfigFor(cfg: AppConfig): FastifyHelmetOptions {
  return {
    hidePoweredBy: true,
    frameguard: { action: "deny" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'", ...cfg.cors.allowedOrigins],
        scriptSrc: [
          "'self'",
          // Inline boot script hash – keep this in sync with the webapp if changed
          "'sha256-+Ul8C6HpBvEV0hgFekKPKiEh0Ug3SIn50SjA+iyTNHo='",
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" as const },
    dnsPrefetchControl: { allow: false },
    referrerPolicy: { policy: "no-referrer" as const },
    xssFilter: true,
    hsts: {
      maxAge: 15_552_000, // 180 days
      includeSubDomains: true,
      preload: true,
    },
  };
}
