import "fastify";
import type { Providers } from "../providers.js";
import type { ChaosState } from "../lib/chaos.js";

declare module "fastify" {
  interface FastifyInstance {
    setDraining: (value: boolean) => void;
    isDraining: () => boolean;
    providers: Providers;
    chaosState: ChaosState;
  }
}

