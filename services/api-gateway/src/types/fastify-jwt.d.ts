import type { AuthTokenPayload } from "./auth";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthTokenPayload;
    user: AuthTokenPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    jwt: {
      sign: (
        payload: AuthTokenPayload,
        options?: { audience?: string; issuer?: string; expiresIn?: number | string }
      ) => Promise<string>;
      verify: (token: string) => Promise<AuthTokenPayload>;
    };
  }
  interface FastifyRequest {
    user: AuthTokenPayload;
    jwtVerify: (options?: unknown) => Promise<AuthTokenPayload>;
    metricsStartTime?: bigint;
    correlationId?: string;
    otelSpan?: import("../telemetry").TelemetrySpan;
    otelContext?: import("../telemetry").TelemetryContext;
  }
  interface FastifyReply {
    jwtSign: (
      payload: AuthTokenPayload,
      options?: { audience?: string; issuer?: string; expiresIn?: number | string }
    ) => Promise<string>;
    context?: { config?: { url?: string } };
  }
}
