import type { FastifyHelmetOptions } from "@fastify/helmet";
import type { AppConfig } from "./config";

type CspDirectives = Record<string, string[]>;

function buildCsp(config: AppConfig): CspDirectives {
  const { allowedOrigins } = config.cors;

  const connectSrc = ["'self'", ...allowedOrigins];

  return {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    connectSrc,
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
  };
}

/**
 * Build a helmet configuration for the given app config.
 * This is what the app and tests should use.
 */
export function helmetConfigFor(config: AppConfig): FastifyHelmetOptions {
  const csp = buildCsp(config);

  const enableIsolation = config.security.enableIsolation === true;

  return {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: csp,
    },
    frameguard: {
      action: "deny",
    },
    referrerPolicy: {
      policy: "no-referrer",
    },
    hsts: {
      maxAge: 60 * 60 * 24 * 180, // 180 days
      includeSubDomains: true,
      preload: false,
    },
    crossOriginEmbedderPolicy: enableIsolation,
    crossOriginOpenerPolicy: enableIsolation
      ? { policy: "same-origin" }
      : { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: {
      policy: "same-site",
    },
  };
}

/**
 * Back-compat alias for older tests.
 * test/regulator-compliance-summary.test.ts imports this by name.
 */
export function buildHelmetConfig(config: AppConfig): FastifyHelmetOptions {
  return helmetConfigFor(config);
}
