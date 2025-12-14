import Fastify from "fastify";
import { registerRiskSummaryRoute } from "../src/routes/risk-summary.js";
import { riskBandGauge } from "../src/observability/metrics.js";

jest.mock("../src/observability/metrics.js", () => ({
  riskBandGauge: {
    set: jest.fn(),
  },
}));

const mockedGaugeSet = riskBandGauge.set as jest.Mock;

describe("/monitor/risk/summary", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    registerRiskSummaryRoute(app as any);
    await app.ready();
    mockedGaugeSet.mockClear();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 401 when no orgId is present", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/monitor/risk/summary?period=2025-Q1",
    });

    expect(res.statusCode).toBe(401);
  });

  it("maps LOW risk to gauge=1", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/monitor/risk/summary?period=2025-Q1&riskBand=LOW",
      headers: { "x-org-id": "org-1" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockedGaugeSet).toHaveBeenCalledWith(
      { orgId: "org-1", period: "2025-Q1" },
      1,
    );
  });

  it("maps MEDIUM risk to gauge=2", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/monitor/risk/summary?period=2025-Q1&riskBand=MEDIUM",
      headers: { "x-org-id": "org-1" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockedGaugeSet).toHaveBeenCalledWith(
      { orgId: "org-1", period: "2025-Q1" },
      2,
    );
  });

  it("maps HIGH risk to gauge=3", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/monitor/risk/summary?period=2025-Q1&riskBand=HIGH",
      headers: { "x-org-id": "org-1" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockedGaugeSet).toHaveBeenCalledWith(
      { orgId: "org-1", period: "2025-Q1" },
      3,
    );
  });
});
