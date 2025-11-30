import "fastify";

type MetricsRecorder = {
  recordSecurityEvent: (event: string) => void;
  incAuthFailure: (orgId: string) => void;
  incCorsReject: (origin: string) => void;
};

type SettlementService = {
  settleBatch: (batch: unknown) => Promise<unknown>;
};

declare module "fastify" {
  interface FastifyInstance {
    metrics?: MetricsRecorder;
    services: {
      userService: unknown;
      payrollService: unknown;
      gstService: unknown;
      paygwSettlement: SettlementService;
      gstSettlement: SettlementService;
    };
  }
}
