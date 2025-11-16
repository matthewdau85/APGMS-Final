import crypto from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  analyzeIntegrationAnomaly,
  logGovernmentSubmission,
  aggregateObligations,
  fetchRecentDiscrepancies,
  listPaymentPlans,
} from "@apgms/shared";
import { metrics } from "../observability/metrics.js";
import { prisma } from "../db.js";

async function buildCompliancePayload(
  orgId: string,
  taxType: string,
): Promise<{
  orgId: string;
  taxType: string;
  pendingObligations: string;
  discrepancies: Array<{
    eventId: string;
    shortfall: string;
    reason: string;
    createdAt: Date;
  }>;
  paymentPlans: Array<{
    id: string;
    status: string;
    reason: string;
    requestedAt: Date;
  }>;
  anomaly: unknown;
}> {
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
    discrepancies: discrepancies.map((alert: any) => ({
      eventId: alert.eventId,
      shortfall: alert.expectedAmount
        .minus(alert.actualAmount)
        .toString(),
      reason: alert.reason,
      createdAt: alert.createdAt,
    })),
    paymentPlans: plans.map((plan: any) => ({
      id: plan.id,
      status: plan.status,
      reason: plan.reason,
      requestedAt: plan.requestedAt,
    })),
    anomaly,
  };
}

export async function registerAtoRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    "/ato/report",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const body = request.body as { orgId?: string; taxType?: string } | undefined;

      const orgId = String(body?.orgId ?? "").trim();
      if (!orgId) {
        reply.code(400).send({ error: "orgId_required" });
        return;
      }

      const taxType = String(body?.taxType ?? "PAYGW").trim();
      const payload = await buildCompliancePayload(orgId, taxType);

      try {
        const endpoint = process.env.ATO_REPORT_ENDPOINT;
        let responseBody: Record<string, unknown> = {};

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
    },
  );

  const stpSchema = z.object({
    orgId: z.string().min(1),
    payRunId: z.string().min(1),
  });

  app.post("/ato/stp/report", async (request, reply) => {
    const params = stpSchema.parse(request.body ?? {});

    const payRun = await prisma.payRun.findUnique({
      where: { id: params.payRunId },
      include: { payslips: true },
    });

    if (!payRun || payRun.orgId !== params.orgId) {
      reply.code(404).send({ error: "pay_run_not_found" });
      return;
    }

    const employees = payRun.payslips.map((payslip) => ({
      employeeId: payslip.employeeId,
      gross: payslip.grossPay.toString(),
      paygw: payslip.paygWithheld.toString(),
      super: payslip.superAccrued.toString(),
    }));

    const basePayload = {
      version: "STP2.0",
      orgId: params.orgId,
      payRun: {
        id: payRun.id,
        paymentDate: payRun.paymentDate,
        period: { start: payRun.periodStart, end: payRun.periodEnd },
      },
      employees,
    };

    const signature = crypto
      .createHash("sha256")
      .update(JSON.stringify(basePayload))
      .digest("hex");

    const payload = { ...basePayload, signature };

    const endpoint = process.env.ATO_STP_ENDPOINT;
    try {
      let responseBody: Record<string, unknown> = {};
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
        orgId: params.orgId,
        method: "/ato/stp/report",
        payload,
        response: responseBody,
        status: "sent",
      });
      metrics.stpReportsTotal.inc({ status: "sent" });
      reply.send({ ok: true, payload, response: responseBody });
    } catch (error) {
      await logGovernmentSubmission({
        orgId: params.orgId,
        method: "/ato/stp/report",
        payload,
        response: { error: String(error) },
        status: "failed",
      });
      metrics.stpReportsTotal.inc({ status: "failed" });
      reply.code(500).send({ error: "stp_submission_failed" });
    }
  });
}
