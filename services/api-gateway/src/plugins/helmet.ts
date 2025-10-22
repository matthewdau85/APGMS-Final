import type { FastifyPluginAsync } from "fastify";

type HelmetDirectives = Record<string, ReadonlyArray<string>>;

type HelmetOptions = {
  contentSecurityPolicy?: {
    directives?: HelmetDirectives;
  };
};

const helmetPlugin: FastifyPluginAsync<HelmetOptions> = async (fastify, options = {}) => {
  const directives = options.contentSecurityPolicy?.directives ?? {};
  const headerValue = buildCspHeader(directives);

  fastify.addHook("onSend", (request, reply, payload, done) => {
    if (headerValue) {
      reply.header("content-security-policy", headerValue);
    }
    reply.header("x-dns-prefetch-control", "off");
    reply.header("x-frame-options", "DENY");
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    done(null, payload);
  });
};

function buildCspHeader(directives: HelmetDirectives): string {
  return Object.entries(directives)
    .map(([key, values]) => `${toDirectiveName(key)} ${values.join(" ")}`)
    .join("; ");
}

function toDirectiveName(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

export default helmetPlugin;
