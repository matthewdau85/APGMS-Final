import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      sub?: string;
      orgId?: string;
      role?: string;
      [key: string]: unknown;
    };
  }

  interface FastifyInstance {
    db: any;
    services: any;
    metrics?: any;
    authGuard?: any;
  }
}
