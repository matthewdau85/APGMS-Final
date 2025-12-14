// services/api-gateway/test/risk-summary.test.ts

import Fastify from "fastify";
import { metrics } from "../src/observability/metrics.js";
import { computeOrgRisk } from "@apgms/domain-policy/risk/anomaly";
import { registerRiskSummaryRoutes } from "../src/routes/risk-summary";

// Mock authGuard: just let everything through and decorate org
jest.mock("../src/auth", () => ({
  authGuard: (req: any, _reply: any, done: any) => {
    if (req.headers["x-org-id"]) {
      req.org = { orgId: req.headers["x-org-id"] };
    }
    done();
  },
}));

jest.mock("@apgms/domain-policy/risk/anomaly", () => ({
  computeOrgRisk: jest.fn(),
}));

jest.mock("../src/observability/metrics.js", () => ({
  metrics: {
    orgRiskScoreGauge: {
      set: jest.fn(),
    },
  },
}));

const mockedCompute = computeOrgRisk as jest.MockedFunction<
  typeof computeOrgRisk
>;
const mockedGaugeSet = metrics.orgRiskScoreGauge.set as jest.Mock;

describe("/monitor/risk/summary", () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify();
    await registerRiskSummaryRoutes(app as any);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockedCompute.mockReset();
    mockedGaugeSet.mockReset();
  });

  it("returns 401 when no orgId is present", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/monitor/risk/summary?period=2025-Q1",
      // no x-org-id header
    });

    expect(res.statusCode).toBe(401);
  });

  it("maps LOW risk to gauge=1", async () => {
    mockedCompute.mockResolvedValueOnce({
      orgId: "org-1",
      period: "2025-Q1",
      bufferCoveragePct: 95,
      fundingConsistencyPct: 90,
      overallLevel: "LOW",
    });

    const res = await app.inject({
      method: "GET",
      url: "/monitor/risk/summary?period=2025-Q1",
      headers: {
        authorization: "Bearer test",
        "x-org-id": "org-1",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockedGaugeSet).toHaveBeenCalledWith(
      { orgId: "org-1", period: "2025-Q1" },
      1,
    );
  });

  it("maps MEDIUM risk to gauge=2", async () => {
    mockedCompute.mockResolvedValueOnce({
      orgId: "org-1",
      period: "2025-Q1",
      bufferCoveragePct: 80,
      fundingConsistencyPct: 70,
      overallLevel: "MEDIUM",
    });

    const res = await app.inject({
      method: "GET",
      url: "/monitor/risk/summary?period=2025-Q1",
      headers: {
        authorization: "Bearer test",
        "x-org-id": "org-1",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockedGaugeSet).toHaveBeenCalledWith(
      { orgId: "org-1", period: "2025-Q1" },
      2,
    );
  });

  it("maps HIGH risk to gauge=3", async () => {
    mockedCompute.mockResolvedValueOnce({
      orgId: "org-1",
      period: "2025-Q1",
      bufferCoveragePct: 60,
      fundingConsistencyPct: 50,
      overallLevel: "HIGH",
    });

    const res = await app.inject({
      method: "GET",
      url: "/monitor/risk/summary?period=2025-Q1",
      headers: {
        authorization: "Bearer test",
        "x-org-id": "org-1",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockedGaugeSet).toHaveBeenCalledWith(
      { orgId: "org-1", period: "2025-Q1" },
      3,
    );
  });
});
