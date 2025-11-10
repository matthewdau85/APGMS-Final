import "fastify";

import type { MlServiceClient } from "../clients/ml-service.js";

declare module "fastify" {
  interface FastifyInstance {
    mlClient: MlServiceClient;
  }
}
