// services/api-gateway/src/security-headers.ts
import type { FastifyHelmetOptions } from "@fastify/helmet";
import type { AppConfig } from "./config.js";

/**
 * Centralised Helmet configuration for the API gateway.
 * We keep it strict enough for ATO/DSP expectations but not so
 * exotic that it breaks local/dev.
 */
export function helmetConfigFor(config: AppConfig): FastifyHelmetOptions {
  const isProduction = config.security.requireHttps;

  const cspDirectives = {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'", "data:"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    // We rely on TLS in prod; this hint is mainly for browsers.
    upgradeInsecureRequests: [] as string[],
  };

  return {
    hidePoweredBy: true,
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "no-referrer" },

    // Helmet/fastify-helmet CSP – always an object here, no booleans,
    // so TS is happy and the browser gets a clear policy.
    contentSecurityPolicy: {
      directives: cspDirectives,
    },

    // Strict HSTS only when we *actually* require HTTPS.
    hsts: isProduction
      ? {
          maxAge: 15552000, // 180 days
          includeSubDomains: true,
          preload: false,
        }
      : false,
  };
}
