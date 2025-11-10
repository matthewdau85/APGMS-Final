import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { prisma } from "../db.js";
import { summarizeMitigations } from "../clients/ml-service.js";
import { authGuard } from "../auth.js";

const reconciliationSchema = z.object({
  cashOnHand: z.number().nonnegative(),
  obligationsDue: z.number().nonnegative(),
  forecastRevenue: z.number().nonnegative(),
  outstandingAlerts: z.number().int().nonnegative(),
});

export const registerRiskRoutes: FastifyPluginAsync = async (app) => {
  app.get("/risk/dashboard", { preHandler: authGuard }, async (_req, reply) => {
    const aggregate = await prisma.bankLine.aggregate({ _sum: { amount: true } });
    const totalExposure = Number(aggregate._sum.amount ?? 0) / 1_000_000;

    const shortfall = await app.mlClient.scoreShortfall({
      cash_on_hand: Math.max(0.5, 7 - totalExposure * 0.5),
      monthly_burn: Math.max(0.4, 1.2 + totalExposure * 0.4),
      obligations_due: Math.max(0.3, totalExposure * 0.9 + 0.2),
      forecast_revenue: Math.max(0.3, 2.2 - totalExposure * 0.2),
    });

    const fraud = await app.mlClient.scoreFraud({
      transfer_amount: Math.max(0.1, totalExposure * 0.8 + 0.1),
      daily_velocity: Math.max(0.2, totalExposure * 1.4 + 0.3),
      anomalous_counterparties: Math.round(Math.min(5, Math.max(0, totalExposure))),
      auth_risk_score: Math.min(1, 0.35 + totalExposure / 8),
      device_trust_score: Math.max(0.2, 0.85 - totalExposure / 10),
    });

    reply.send({
      shortfall: { ...shortfall, mitigations: summarizeMitigations(shortfall) },
      fraud: { ...fraud, mitigations: summarizeMitigations(fraud) },
    });
  });

  app.post("/risk/ledger-reconciliation", { preHandler: authGuard }, async (req, reply) => {
    const parsed = reconciliationSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }

    const { cashOnHand, obligationsDue, forecastRevenue, outstandingAlerts } = parsed.data;
    const shortfall = await app.mlClient.scoreShortfall({
      cash_on_hand: cashOnHand,
      monthly_burn: Math.max(0.1, obligationsDue * 0.6 + outstandingAlerts * 0.3),
      obligations_due: obligationsDue,
      forecast_revenue: forecastRevenue,
    });

    reply.send({
      ok: !shortfall.exceeds_threshold && shortfall.score < shortfall.threshold,
      shortfall,
      mitigations: summarizeMitigations(shortfall),
    });
  });
};

export default registerRiskRoutes;
