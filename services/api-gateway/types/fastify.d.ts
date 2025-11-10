import type { MlServiceClient } from "../src/clients/ml-service.js";

declare module "fastify" {
  interface FastifyInstance {
    mlClient: MlServiceClient;
  }
}
