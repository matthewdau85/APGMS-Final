import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      sub: string;
      orgId: string;
      role: string;
    };
  }
}
