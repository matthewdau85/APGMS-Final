import type { FastifyPluginAsync } from "fastify";

export type CspDirectives = Record<string, readonly string[]>;

export interface SecurityHeadersOptions {
  contentSecurityPolicy: {
    directives: CspDirectives;
  };
}

function serializeDirectives(directives: CspDirectives): string {
  return Object.entries(directives)
    .map(([directive, values]) => {
      const entries = values.filter((value) => value.length > 0);
      if (entries.length === 0) {
        return directive;
      }
      return `${directive} ${entries.join(" ")}`;
    })
    .join("; ");
}

const securityHeaders: FastifyPluginAsync<SecurityHeadersOptions> = async (fastify, options) => {
  const cspHeaderValue = serializeDirectives(options.contentSecurityPolicy.directives);
  fastify.log.debug({ cspHeaderValue }, "security headers ready");

  fastify.addHook("onRequest", async (_request, reply) => {
    reply
      .header("Content-Security-Policy", cspHeaderValue)
      .header("X-Content-Type-Options", "nosniff")
      .header("X-Frame-Options", "DENY")
      .header("Referrer-Policy", "no-referrer")
      .header("X-DNS-Prefetch-Control", "off")
      .header("X-Download-Options", "noopen")
      .header("X-Permitted-Cross-Domain-Policies", "none")
      .header("Cross-Origin-Opener-Policy", "same-origin")
      .header("Cross-Origin-Resource-Policy", "same-origin")
      .header("X-XSS-Protection", "0");
    const raw = reply.raw;
    raw.setHeader("Content-Security-Policy", cspHeaderValue);
    raw.setHeader("content-security-policy", cspHeaderValue);
    raw.setHeader("X-Content-Type-Options", "nosniff");
    raw.setHeader("X-Frame-Options", "DENY");
    raw.setHeader("Referrer-Policy", "no-referrer");
    raw.setHeader("X-DNS-Prefetch-Control", "off");
    raw.setHeader("X-Download-Options", "noopen");
    raw.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    raw.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    raw.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    raw.setHeader("X-XSS-Protection", "0");
  });
};

export default securityHeaders;
