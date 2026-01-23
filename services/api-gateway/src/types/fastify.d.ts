// src/types/fastify.d.ts
import "fastify";

declare module "fastify" {
  interface FastifyInstance {
    services: any;
    metrics: any;
  }
}
