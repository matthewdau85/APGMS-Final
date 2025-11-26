import "fastify";

declare module "fastify" {
  interface FastifyInstance {
    services: {
      userService: unknown;
      payrollService: unknown;
      gstService: unknown;
    };
  }
}
