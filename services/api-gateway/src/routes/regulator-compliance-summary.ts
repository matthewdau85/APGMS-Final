// services/api-gateway/src/routes/regulator-compliance-summary.ts

import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";

interface ComplianceSummaryItem {
  orgId: string;
  orgName: string;
  basCoverageRatio: number; // 0–1
  paygwShortfallCents: number;
  gstShortfallCents: number;
  lateBasCount: number;
  riskBand: "LOW" | "MEDIUM" | "HIGH";
}

interface ComplianceSummaryResponse {
  generatedAt: string;
  items: ComplianceSummaryItem[];
}

export async function registerRegulatorComplianceSummaryRoute(
  app: FastifyInstance,
  _config: AppConfig
): Promise<void> {
  app.get<{ Reply: ComplianceSummaryResponse }>(
    "/regulator/compliance/summary",
    async (request, reply) => {
      // In a real implementation this would query your domain layer.
      const demo: ComplianceSummaryResponse = {
        generatedAt: new Date().toISOString(),
        items: [
          {
            orgId: "org-demo-1",
            orgName: "Demo Pty Ltd",
            basCoverageRatio: 0.92,
            paygwShortfallCents: 0,
            gstShortfallCents: 12500,
            lateBasCount: 0,
            riskBand: "LOW",
          },
          {
            orgId: "org-demo-2",
            orgName: "Stretched Cafe Group",
            basCoverageRatio: 0.61,
            paygwShortfallCents: 380000,
            gstShortfallCents: 95000,
            lateBasCount: 2,
            riskBand: "HIGH",
          },
        ],
      };

      return reply.code(200).send(demo);
    }
  );
}
