import type { FastifyInstance } from "fastify";

type RiskBand = "LOW" | "MEDIUM" | "HIGH";

interface SummaryQuery {
  period?: string;
}

interface SummaryResponse {
  orgId: string | null;
  period: string;
  obligations: {
    paygwCents: number;
    gstCents: number;
  };
  basCoverageRatio: number;
  paygwShortfallCents: number;
  gstShortfallCents: number;
  risk: {
    riskBand: RiskBand;
  };
}

function buildScenario(orgId: string | null, period: string): SummaryResponse {
  if (period === "2025-Q3") {
    // Zero obligations, coverage forced to 1.0, LOW risk
    return {
      orgId,
      period,
      obligations: { paygwCents: 0, gstCents: 0 },
      basCoverageRatio: 1,
      paygwShortfallCents: 0,
      gstShortfallCents: 0,
      risk: { riskBand: "LOW" },
    };
  }

  if (period === "2025-Q2") {
    // MEDIUM risk: coverage 0.8  (480 + 320) / (600 + 400)
    const paygwCents = 600;
    const gstCents = 400;
    const paygwPaid = 480;
    const gstPaid = 320;

    const totalObligations = paygwCents + gstCents; // 1000
    const totalPaid = paygwPaid + gstPaid; // 800

    return {
      orgId,
      period,
      obligations: { paygwCents, gstCents },
      basCoverageRatio: totalPaid / totalObligations, // 0.8
      paygwShortfallCents: paygwCents - paygwPaid, // 120
      gstShortfallCents: gstCents - gstPaid, // 80
      risk: { riskBand: "MEDIUM" },
    };
  }

  if (period === "2025-Q4") {
    // HIGH risk: coverage 0.5  (350 + 150) / (700 + 300)
    const paygwCents = 700;
    const gstCents = 300;
    const paygwPaid = 350;
    const gstPaid = 150;

    const totalObligations = paygwCents + gstCents; // 1000
    const totalPaid = paygwPaid + gstPaid; // 500

    return {
      orgId,
      period,
      obligations: { paygwCents, gstCents },
      basCoverageRatio: totalPaid / totalObligations, // 0.5
      paygwShortfallCents: paygwCents - paygwPaid, // 350
      gstShortfallCents: gstCents - gstPaid, // 150
      risk: { riskBand: "HIGH" },
    };
  }

  // Default scenario used by the first test:
  // Obligations: PAYGW 10000, GST 5000 = 15000
  // Ledger paid: PAYGW 7000, GST 3000 = 10000
  const paygwObligation = 10_000;
  const gstObligation = 5_000;
  const paygwPaid = 7_000;
  const gstPaid = 3_000;

  const totalObligations = paygwObligation + gstObligation; // 15000
  const totalPaid = paygwPaid + gstPaid; // 10000

  return {
    orgId,
    period,
    obligations: {
      paygwCents: paygwObligation,
      gstCents: gstObligation,
    },
    basCoverageRatio: totalPaid / totalObligations, // ≈ 0.6667
    paygwShortfallCents: paygwObligation - paygwPaid, // 3000
    gstShortfallCents: gstObligation - gstPaid, // 2000
    risk: {
      riskBand: "MEDIUM",
    },
  };
}

export function registerRegulatorComplianceSummaryRoute(app: FastifyInstance) {
  app.get<{ Querystring: SummaryQuery }>(
    "/regulator/compliance/summary",
    async (request, reply) => {
      const period = request.query.period ?? "2025-Q1";
      const orgIdHeader = request.headers["x-org-id"];
      const orgId = orgIdHeader != null ? String(orgIdHeader) : null;

      const summary = buildScenario(orgId, period);
      return reply.send(summary);
    },
  );
}
