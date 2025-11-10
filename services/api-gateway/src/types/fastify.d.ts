import "fastify";

declare module "fastify" {
  interface FastifyInstance {
    config: {
      taxEngineUrl?: string;
      [k: string]: unknown;
    };
    metrics?: {
      recordSecurityEvent?: (code: string) => void;
      recordDeviceRiskEvent?: (level: string, reason: string) => void;
      recordMfaEnforcement?: (reason: string) => void;
      httpRequestTotal?: any;
      httpRequestDuration?: { startTimer: (labels?: Record<string,string>) => (labels?: Record<string,string>) => void };
    };
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
    mutualTls?: {
      subject?: string;
      issuer?: string;
      validTo?: string;
      fingerprint256?: string;
    };
  }
}
