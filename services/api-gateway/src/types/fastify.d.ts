import "fastify";
import type { RiskEventPublisher } from "../lib/risk-events.js";

declare module "fastify" {
  interface FastifyInstance {
    config: {
      taxEngineUrl?: string;
      [k: string]: unknown;
    };
    metrics?: {
      recordSecurityEvent?: (code: string) => void;
      httpRequestTotal?: any;
      httpRequestDuration?: { startTimer: (labels?: Record<string,string>) => (labels?: Record<string,string>) => void };
    };
    isDraining?: () => boolean;
    setDraining?: (v: boolean) => void;
    providers?: {
      redis?: { ping: () => Promise<string> } | null;
      nats?: { flush: () => Promise<void> } | null;
    };
    riskEvents?: RiskEventPublisher;
  }

  interface FastifyRequest {
    user?: {
      sub: string;
      orgId: string;
      role: string;
      mfaEnabled: boolean;
    };
  }
}
