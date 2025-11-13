import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { analyzeIntegrationAnomaly, logGovernmentSubmission } from "@apgms/shared";
import { aggregateObligations, fetchRecentDiscrepancies, listPaymentPlans } from "@apgms/shared";
import { metrics } from "../observability/metrics.js";

async function buildCompliancePayload(orgId: string, taxType: string) {
  const [obligations, discrepancies, plans, anomaly] = await Promise.all([
    aggregateObligations(orgId, taxType),
    fetchRecentDiscrepancies(orgId),
    listPaymentPlans(orgId),
    analyzeIntegrationAnomaly(orgId, taxType),
  ]);
  return {
    orgId,
    taxType,
    pendingObligations: obligations.toString(),
    discrepancies: discrepancies.map((alert) => ({
      eventId: alert.eventId,
      shortfall: alert.expectedAmount.minus(alert.actualAmount).toString(),
      reason: alert.reason,
      createdAt: alert.createdAt,
    })),
    paymentPlans: plans.map((plan) => ({
      id: plan.id,
      status: plan.status,
      reason: plan.reason,
      requestedAt: plan.requestedAt,
    })),
    anomaly,
  };
}

export async function registerAtoRoutes(app: FastifyInstance) {
  app.post("/ato/report", async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = String((request.body as { orgId?: string }).orgId ?? "").trim();
    if (!orgId) {
      reply.code(400).send({ error: "orgId_required" });
      return;
    }
    const taxType = String((request.body as { taxType?: string }).taxType ?? "PAYGW").trim();
    const payload = await buildCompliancePayload(orgId, taxType);
    try {
      const endpoint = process.env.ATO_REPORT_ENDPOINT;
      let responseBody = {};
      if (endpoint) {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        responseBody = {
          status: response.status,
          text: await response.text(),
        };
      }
      await logGovernmentSubmission({
        orgId,
        method: "/ato/report",
        payload,
        response: responseBody,
        status: "sent",
      });
      metrics.atoReportsTotal.inc({ status: "sent" });
      reply.send({ ok: true, payload, response: responseBody });
    } catch (error) {
      await logGovernmentSubmission({
        orgId,
        method: "/ato/report",
        payload,
        response: { error: String(error) },
        status: "failed",
      });
      metrics.atoReportsTotal.inc({ status: "failed" });
      reply.code(500).send({ error: "submission_failed" });
    }
  });
}
