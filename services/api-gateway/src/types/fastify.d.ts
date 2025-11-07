import "fastify";
import type { Providers } from "../providers.js";
import type { AppSecurityMetrics } from "../observability/metrics.js";

declare module "fastify" {
  interface FastifyInstance {
    setDraining: (value: boolean) => void;
    isDraining: () => boolean;
    providers: Providers;
    metrics: AppSecurityMetrics;
  }
}

