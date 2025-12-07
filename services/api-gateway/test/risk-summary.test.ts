// services/api-gateway/test/risk-summary.test.ts

import Fastify from "fastify";
import { registerRiskRoutes } from "../src/routes/risk";
import { metrics } from "../src/observability/metrics.js";
import { computeOrgRisk } from "@apgms/domain-policy/risk/anomaly";

// Mock the risk computation module
jest.mock("@apgms/domain-policy/risk/anomaly");

const mockedCompute = jest.mocked(computeOrgRisk);

// Stub authGuard for these tests to control orgId behaviour
jest.mock("../src/auth.js", () => {
  return {
    authGuard: async (req: any, reply: any) => {
      const auth = req.headers.authorization;
      if (!auth) {
        reply.code(401).send({ error: "unauthenticated" });
        return;
      }
      // Attach a fake org for success cases
      req.org = { orgId: "test-org" };
    },
  };
});

function buildServer() {
  const app = Fastify();

  // Ensure metrics object has a gauge we can spy on
  (metrics as any).orgRiskScoreGauge = {
    set: jest.fn(),
  };
  (metrics as any).riskEventsTotal = (metrics as any).riskEventsTotal ?? {
    inc: jest.fn(),
  };

  // Minimal config object – not used in routes
  registerRiskRoutes(app as any, {} as any);

  return app;
}

describe("/monitor/risk/summary", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns LOW risk summary and sets gauge to 1", async () => {
    const app = buildServer();

    const snapshot = {
      overallLevel: "LOW",
      reasons: [],
      period: "2025-Q1",
    };

    mockedCompute.mockResolvedValueOnce(snapshot as any);

    const res = await app.inject({
      method: "GET",
      url: "/monitor/risk/summary?period=2025-Q1",
      headers: {
        Authorization: "Bearer test-token",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Body matches the mocked snapshot
    expect(body).toEqual(snapshot);

    const gauge = (metrics as any).orgRiskScoreGauge;
    expect(gauge.set).toHaveBeenCalledTimes(1);
    expect(gauge.set).toHaveBeenCalledWith(
      { orgId: "test-org", period: "2025-Q1" },
      1,
    );

    await app.close();
  });

  it("MEDIUM maps to score 2", async () => {
    const app = buildServer();

    const snapshot = {
      overallLevel: "MEDIUM",
      reasons: ["coverage below target"],
      period: "2025-Q2",
    };

    mockedCompute.mockResolvedValueOnce(snapshot as any);

    const res = await app.inject({
      method: "GET",
      url: "/monitor/risk/summary?period=2025-Q2",
      headers: {
        Authorization: "Bearer another-token",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.overallLevel).toBe("MEDIUM");

    const gauge = (metrics as any).orgRiskScoreGauge;
    expect(gauge.set).toHaveBeenCalledWith(
      { orgId: "test-org", period: "2025-Q2" },
      2,
    );

    await app.close();
  });

  it("HIGH maps to score 3", async () => {
    const app = buildServer();

    const snapshot = {
      overallLevel: "HIGH",
      reasons: ["sustained shortfall"],
      period: "2025-Q3",
    };

    mockedCompute.mockResolvedValueOnce(snapshot as any);

    const res = await app.inject({
      method: "GET",
      url: "/monitor/risk/summary?period=2025-Q3",
      headers: {
        Authorization: "Bearer high-risk",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.overallLevel).toBe("HIGH");

    const gauge = (metrics as any).orgRiskScoreGauge;
    expect(gauge.set).toHaveBeenCalledWith(
      { orgId: "test-org", period: "2025-Q3" },
      3,
    );

    await app.close();
  });

  it("returns 401 when no orgId (no Authorization header)", async () => {
    const app = buildServer();

    const res = await app.inject({
      method: "GET",
      url: "/monitor/risk/summary?period=2025-Q1",
      // no Authorization header
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "unauthenticated" });

    await app.close();
  });
});
