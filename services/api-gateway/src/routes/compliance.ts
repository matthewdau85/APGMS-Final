import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticateRequest, type Role } from "../lib/auth.js";
import { prisma } from "../db.js";
import { mlServiceClient } from "../clients/mlServiceClient.js";
import { fetchFraudRisk, fetchShortfallRisk } from "../lib/risk.js";

function guard(app: FastifyInstance, roles: readonly Role[] = []) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await authenticateRequest(app, req, reply, roles);
  };
}

function toBasHistoryEntry(cycle: any) {
  return {
    period: `${cycle.periodStart.toISOString().slice(0, 10)} – ${cycle.periodEnd.toISOString().slice(0, 10)}`,
    lodgedAt: cycle.lodgedAt ? cycle.lodgedAt.toISOString() : null,
    status: cycle.overallStatus,
    notes: cycle.overallStatus,
  };
}

export async function registerComplianceRoutes(app: FastifyInstance) {
  app.get(
    "/compliance/report",
    { preHandler: guard(app, []) },
    async (req, reply) => {
      const principal = (req as any).user;
      const orgId: string = principal?.orgId;

      const [basCycles, paymentPlans, openHighSeverity, resolvedQuarter, accounts] = await Promise.all([
        prisma.basCycle.findMany({
          where: { orgId },
          orderBy: { periodEnd: "desc" },
          take: 6,
        }),
        prisma.paymentPlanRequest.findMany({
          where: { orgId },
          orderBy: { requestedAt: "desc" },
          take: 10,
        }),
        prisma.alert.count({
          where: { orgId, severity: "HIGH", resolvedAt: null },
        }),
        prisma.alert.count({
          where: {
            orgId,
            severity: "HIGH",
            resolvedAt: {
              gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        prisma.designatedAccount.findMany({ where: { orgId } }),
      ]);

      const nextBasDue = basCycles.find((cycle) => cycle.lodgedAt === null)?.periodEnd ?? null;

      const designatedTotals = accounts.reduce(
        (acc, account) => {
          if (account.type === "PAYGW_BUFFER") {
            acc.paygw += Number(account.balance);
          }
          if (account.type === "GST_BUFFER") {
            acc.gst += Number(account.balance);
          }
          return acc;
        },
        { paygw: 0, gst: 0 },
      );

      let shortfallRisk = null;
      try {
        shortfallRisk = await fetchShortfallRisk(mlServiceClient, orgId);
      } catch (error) {
        req.log?.warn({ err: error }, "ml_shortfall_risk_failed_compliance");
      }

      let fraudRisk = null;
      const latestLine = await prisma.bankLine.findFirst({
        where: { orgId },
        orderBy: { date: "desc" },
      });
      if (latestLine) {
        try {
          fraudRisk = await fetchFraudRisk(mlServiceClient, {
            orgId,
            amount: Number(latestLine.amount),
            settlementDate: latestLine.date,
            payeeFingerprint: latestLine.payeeCiphertext,
          });
        } catch (error) {
          req.log?.warn({ err: error }, "ml_fraud_risk_failed_compliance");
        }
      }

      reply.send({
        orgId,
        basHistory: basCycles.map(toBasHistoryEntry),
        alertsSummary: {
          openHighSeverity,
          resolvedThisQuarter: resolvedQuarter,
        },
        nextBasDue: nextBasDue ? nextBasDue.toISOString() : null,
        designatedTotals,
        paymentPlans: paymentPlans.map((plan) => ({
          id: plan.id,
          basCycleId: plan.basCycleId,
          requestedAt: plan.requestedAt.toISOString(),
          status: plan.status,
          reason: plan.reason,
          details: plan.detailsJson ?? {},
          resolvedAt: plan.resolvedAt ? plan.resolvedAt.toISOString() : null,
        })),
        mlInsights: {
          shortfall: shortfallRisk,
          fraud: fraudRisk,
        },
      });
    },
  );
}

export default registerComplianceRoutes;
