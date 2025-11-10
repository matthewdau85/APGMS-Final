import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { MlRiskClient } from "../clients/ml-service.js";

const ledgerSchema = z.object({
  orgId: z.string().min(1),
  totalExposure: z.number().nonnegative(),
  securedPercentage: z.number().min(0),
  varianceAmount: z.number(),
  unreconciledEntries: z.number().int().min(0),
  basWindowDays: z.number().int().min(0).default(0),
});

const fraudSchema = z.object({
  transactionId: z.string().min(1),
  amount: z.number().nonnegative(),
  channelRisk: z.number().min(0),
  velocity: z.number().min(0),
  geoDistance: z.number().min(0),
  accountTenureDays: z.number().int().min(0),
  previousIncidents: z.number().int().min(0),
});

function ensureClient(app: FastifyInstance): MlRiskClient {
  const client: MlRiskClient | undefined = (app as any).mlClient;
  if (!client) {
    throw Object.assign(new Error("ml_client_unavailable"), { statusCode: 503 });
  }
  return client;
}

export async function registerRiskRoutes(app: FastifyInstance): Promise<void> {
  app.post("/risk/ledger-reconciliation", async (request, reply) => {
    const parsed = ledgerSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }
    let client: MlRiskClient;
    try {
      client = ensureClient(app);
    } catch (error: unknown) {
      reply.code((error as any)?.statusCode ?? 503).send({ error: "ml_unavailable" });
      return;
    }
    const payload = parsed.data;
    const liquidityCoverage = Math.max(0, payload.securedPercentage);
    const varianceImpact = payload.totalExposure > 0 ? Math.max(0, payload.varianceAmount) / payload.totalExposure : 0;
    const escrowCoverage = Math.max(0, liquidityCoverage - varianceImpact);

    const risk = await client.evaluateShortfall({
      orgId: payload.orgId,
      liquidityCoverage,
      escrowCoverage,
      outstandingAlerts: payload.unreconciledEntries,
      basWindowDays: payload.basWindowDays,
      recentShortfalls: varianceImpact > 0.05 ? 2 : varianceImpact > 0.01 ? 1 : 0,
    });

    const blocked = risk.riskLevel === "high";
    const response: Record<string, unknown> = { blocked, risk };
    if (blocked) {
      reply.code(409).send(response);
      return;
    }
    if (risk.riskLevel === "medium") {
      response.warning = "ledger_reconciliation_medium";
    }
    reply.send(response);
  });

  app.post("/risk/fraud-screen", async (request, reply) => {
    const parsed = fraudSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }
    let client: MlRiskClient;
    try {
      client = ensureClient(app);
    } catch (error: unknown) {
      reply.code((error as any)?.statusCode ?? 503).send({ error: "ml_unavailable" });
      return;
    }
    const payload = parsed.data;
    const risk = await client.evaluateFraud({
      transactionId: payload.transactionId,
      amount: payload.amount,
      channelRisk: payload.channelRisk,
      velocity: payload.velocity,
      geoDistance: payload.geoDistance,
      accountTenureDays: payload.accountTenureDays,
      previousIncidents: payload.previousIncidents,
    });

    const blocked = risk.riskLevel === "high";
    const response: Record<string, unknown> = { blocked, risk };
    if (blocked) {
      reply.code(409).send(response);
      return;
    }
    if (risk.riskLevel === "medium") {
      response.warning = "fraud_screen_medium";
    }
    reply.send(response);
  });
}

export default registerRiskRoutes;
