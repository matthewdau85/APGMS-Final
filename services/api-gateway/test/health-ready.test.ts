import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../src/config";

// --- Mocks -------------------------------------------------------------------
const fakeConfig: AppConfig = {
  env: "test",
  databaseUrl: "postgres://localhost:5432/apgms",
  shadowDatabaseUrl: undefined,
  rateLimit: { max: 100, window: "1 minute" },
  security: {
    authFailureThreshold: 5,
    kmsKeysetLoaded: true,
    requireHttps: false,
  },
  cors: {
    allowedOrigins: ["http://localhost:5173"],
  },
  taxEngineUrl: "https://tax.localhost",
  auth: {
    audience: "aud",
    issuer: "iss",
    devSecret: "dev-secret",
  },
  regulator: {
    accessCode: "code",
    jwtAudience: "reg-aud",
    sessionTtlMinutes: 60,
  },
  encryption: { masterKey: Buffer.alloc(32, 1) },
  webauthn: {
    rpId: "localhost",
    rpName: "APGMS",
    origin: "http://localhost:5173",
  },
  banking: {
    providerId: "mock",
    maxReadTransactions: 100,
    maxWriteCents: 1_000_000,
  },
  redis: undefined,
  nats: undefined,
};

const mockPrisma = {
  $queryRaw: jest.fn().mockResolvedValue([1]),
};

const mockProviders = {
  redis: {
    ping: jest.fn().mockResolvedValue("PONG"),
  },
  nats: {
    flush: jest.fn().mockResolvedValue(undefined),
  },
};

const noopPlugin = async () => {};
const securedRoutePlugin = async (app: FastifyInstance) => {
  app.get("/bank-lines", async () => ({ ok: true }));
};

jest.mock("../src/config", () => ({
  config: fakeConfig,
}));

jest.mock("../src/db", () => ({
  prisma: mockPrisma,
}));

jest.mock("../src/providers", () => ({
  initProviders: jest.fn(async () => mockProviders),
  closeProviders: jest.fn(async () => {}),
}));

jest.mock("../src/auth", () => {
  const authGuard = (request: any, reply: any, done: () => void) => {
    if (!request.headers.authorization) {
      reply.code(401).send({ error: { code: "unauthorized" } });
      return;
    }
    done();
  };
  return {
    authGuard,
    createAuthGuard: () => authGuard,
    REGULATOR_AUDIENCE: "reg-aud",
  };
});

jest.mock("../src/plugins/rate-limit", () => ({
  __esModule: true,
  default: async () => {},
}));

jest.mock("../src/routes/auth", () => ({
  registerAuthRoutes: noopPlugin,
}));
jest.mock("../src/routes/regulator-auth", () => ({
  registerRegulatorAuthRoutes: noopPlugin,
}));
jest.mock("../src/routes/regulator", () => ({
  registerRegulatorRoutes: noopPlugin,
}));
jest.mock("../src/routes/admin.data", () => ({
  registerAdminDataRoutes: noopPlugin,
}));
jest.mock("../src/routes/bank-lines", () => ({
  registerBankLinesRoutes: securedRoutePlugin,
}));
jest.mock("../src/routes/tax", () => ({
  registerTaxRoutes: noopPlugin,
}));
jest.mock("../src/routes/connectors", () => ({
  __esModule: true,
  default: noopPlugin,
}));
jest.mock("../src/routes/bas", () => ({
  registerBasRoutes: noopPlugin,
}));
jest.mock("../src/routes/transfers", () => ({
  registerTransferRoutes: noopPlugin,
}));
jest.mock("../src/routes/integration-events", () => ({
  registerIntegrationEventRoutes: noopPlugin,
}));
jest.mock("../src/routes/payment-plans", () => ({
  registerPaymentPlanRoutes: noopPlugin,
}));
jest.mock("../src/routes/ato", () => ({
  registerAtoRoutes: noopPlugin,
}));
jest.mock("../src/routes/monitoring", () => ({
  registerMonitoringRoutes: noopPlugin,
}));
jest.mock("../src/routes/risk", () => ({
  registerRiskRoutes: noopPlugin,
}));
jest.mock("../src/routes/demo", () => ({
  registerDemoRoutes: noopPlugin,
}));
jest.mock("../src/routes/compliance-proxy", () => ({
  registerComplianceProxy: async () => {},
}));
jest.mock("../src/routes/compliance-monitor", () => ({
  registerComplianceMonitorRoutes: noopPlugin,
}));
jest.mock("../src/routes/onboarding", () => ({
  registerOnboardingRoutes: noopPlugin,
}));
jest.mock("../src/routes/forecast", () => ({
  registerForecastRoutes: noopPlugin,
}));
jest.mock("../src/lib/regulator-session", () => ({
  ensureRegulatorSessionActive: jest.fn(async () => ({ id: "sess-1" })),
}));
jest.mock("@apgms/shared", () => {
  class AppError extends Error {
    status: number;
    code: string;
    fields?: any;
    constructor(message = "error", status = 400, code = "app_error", fields?: any) {
      super(message);
      this.status = status;
      this.code = code;
      this.fields = fields;
    }
  }
  const make = (code: string, status: number) => (message = code, fields?: any) =>
    new AppError(message, status, code, fields);
  return {
    AppError,
    badRequest: make("bad_request", 400),
    conflict: make("conflict", 409),
    forbidden: make("forbidden", 403),
    notFound: make("not_found", 404),
    unauthorized: make("unauthorized", 401),
  };
});

// --- Tests -------------------------------------------------------------------
import { buildServer } from "../src/app";

describe("health and readiness routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it("/health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, service: "api-gateway" });
  });

  it("/ready returns ok when providers succeed", async () => {
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      components: { db: true, redis: true, nats: true },
    });
  });

  it("auth guard returns 401 on secured routes without auth", async () => {
    const res = await app.inject({ method: "GET", url: "/bank-lines" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { code: "unauthorized" } });
  });
});
