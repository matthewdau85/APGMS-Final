// services/api-gateway/test/regulator-compliance-summary.test.ts

import fastify from "fastify";
import helmet from "@fastify/helmet";
import { buildHelmetConfig } from "../src/security-headers";
import { registerRegulatorComplianceSummaryRoute } from "../src/routes/regulator-compliance-summary";
import type { AppConfig } from "../src/config";

const baseConfig: AppConfig = {
  env: "test",
  security: {
    enableIsolation: false,
  },
};

describe("/regulator/compliance/summary", () => {
  it("returns a compliant demo payload", async () => {
    const app = fastify();

    await app.register(helmet, buildHelmetConfig({ config: baseConfig }));
    await registerRegulatorComplianceSummaryRoute(app, baseConfig);

    const res = await app.inject({
      method: "GET",
      url: "/regulator/compliance/summary",
    });

    expect(res.statusCode).toBe(200);

    const body = res.json() as {
      generatedAt: string;
      items: Array<{ orgId: string; riskBand: string }>;
    };

    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0]).toHaveProperty("orgId");
    expect(body.items[0]).toHaveProperty("riskBand");
  });
});
