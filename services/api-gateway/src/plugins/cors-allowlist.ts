// services/api-gateway/src/plugins/cors-allowlist.ts
import type { FastifyPluginAsync } from "fastify";

export type CorsAllowlistPluginOptions = {
  environment: string;
  allowedOrigins: string[];
};

function originAllowed(origin: string, allowed: string[]): boolean {
  if (!origin) return true; // no Origin header => treat as non-browser/same-origin
  return allowed.includes(origin);
}

// Minimal CORS allowlist guard:
// - In production: block requests with an Origin not in allowedOrigins
// - In non-production: do not block (dev/test friendliness)
// Note: this does not implement full CORS; it only enforces the allowlist gate.
export const corsAllowlistPlugin: FastifyPluginAsync<CorsAllowlistPluginOptions> = async (app, opts) => {
  const env = String(opts.environment || "development");
  const allowed = Array.isArray(opts.allowedOrigins) ? opts.allowedOrigins : [];

  app.addHook("onRequest", async (request, reply) => {
    const origin = String(request.headers.origin || "");

    // Never block non-browser requests
    if (!origin) return;

    if (env !== "production") return;

    if (!originAllowed(origin, allowed)) {
      reply.code(403).send({ error: "Forbidden" });
      return;
    }

    // If it's a preflight, respond quickly.
    if (request.method === "OPTIONS") {
      reply
        .header("Vary", "Origin")
        .header("Access-Control-Allow-Origin", origin)
        .header("Access-Control-Allow-Credentials", "true")
        .header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Secret")
        .header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
        .code(204)
        .send();
    }
  });
};
