import "fastify";

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
    publishDomainEvent?: (event: {
      subject: string;
      eventType: string;
      orgId: string;
      key: string;
      payload: unknown;
      schemaVersion?: string;
      dedupeId?: string;
      source?: string;
      timestamp?: Date | string;
    }) => Promise<void>;
  }

  interface FastifyRequest {
    user?: {
      sub: string;
      orgId: string;
      role: string;
      mfaEnabled: boolean;
      roles?: string[];
      token?: string;
    };
    principal?: {
      id: string;
      orgId: string;
      roles: string[];
      token: string;
    };
    publishDomainEvent?: (event: {
      subject: string;
      eventType: string;
      orgId: string;
      key: string;
      payload: unknown;
      schemaVersion?: string;
      dedupeId?: string;
      source?: string;
      timestamp?: Date | string;
    }) => Promise<void>;
  }
}
