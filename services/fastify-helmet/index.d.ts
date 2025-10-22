import type { FastifyPluginAsync } from "fastify";

type CspDirectives = Record<string, Array<string> | string>;

type HelmetOptions = {
  contentSecurityPolicy?: {
    directives: CspDirectives;
  };
  hsts?:
    | false
    | {
        maxAge?: number;
        includeSubDomains?: boolean;
        preload?: boolean;
      };
  frameguard?:
    | string
    | {
        action?: string;
      };
  xssFilter?:
    | boolean
    | string
    | {
        value?: string;
      };
};

declare const helmet: FastifyPluginAsync<HelmetOptions>;

export default helmet;
