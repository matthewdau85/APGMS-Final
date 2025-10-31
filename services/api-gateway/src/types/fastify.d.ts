import "fastify";
import type { Providers } from "../providers.js";

declare module "fastify" {
  interface FastifyInstance {
    setDraining: (value: boolean) => void;
    isDraining: () => boolean;
    providers: Providers;
  }
}

