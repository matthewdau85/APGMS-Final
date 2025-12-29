import "fastify";

/* =========================
 * Shared domain interfaces
 * ========================= */

export interface MetricsRecorder {
  recordSecurityEvent: (event: string) => void;
  incAuthFailure: (orgId: string) => void;
  incCorsReject: (origin: string) => void;
}

export interface SettlementService {
  settleBatch: (batch: unknown) => Promise<unknown>;
}

export interface AuthenticatedUser {
  sub: string;
  orgId: string;
  role: "admin" | "user";
  mfaCompleted?: boolean;
}

/* =========================
 * Fastify augmentation
 * ========================= */

declare module "fastify" {
  interface FastifyInstance {
    db: unknown;
    metrics?: MetricsRecorder;
    services: {
      userService: unknown;
      payrollService: unknown;
      gstService: unknown;
      paygwSettlement: SettlementService;
      gstSettlement: SettlementService;
    };
  }

  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}
