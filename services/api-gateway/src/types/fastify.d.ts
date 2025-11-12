import "fastify";
import type { dspPilotMetrics } from "../metrics/dsp-pilot.js";

type DspPilotMetrics = typeof dspPilotMetrics;

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
    pilotMetrics?: DspPilotMetrics;
    isDraining?: () => boolean;
    setDraining?: (v: boolean) => void;
    providers?: {
      redis?: { ping: () => Promise<string> } | null;
      nats?: { flush: () => Promise<void> } | null;
    };
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
