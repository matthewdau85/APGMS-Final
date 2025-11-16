import { type FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../lib/validation.js";
import {
  recordPayrollContribution,
  recordPosTransaction,
  summarizeContributions,
} from "@apgms/shared/ledger/ingest.js";
import {
  ensureDesignatedAccountCoverage,
  reconcileAccountSnapshot,
} from "@apgms/shared/ledger/designated-account.js";
import { prisma } from "../db.js";
import {
  contributionSchema,
  precheckSchema,
} from "../schemas/designated-ingest.js";

export const registerComplianceMonitorRoutes: FastifyPluginAsync = async (app) => {
  app.post("/ingest/payroll", async (req, reply) => {
    const contribution = parseWithSchema(contributionSchema, req.body);
    await recordPayrollContribution({
      prisma,
      orgId: contribution.orgId,
      amount: contribution.amount,
      actorId: contribution.actorId,
      payload: contribution.payload,
      idempotencyKey: req.headers["idempotency-key"] as string | undefined,
    });
    reply.code(202).send({ status: "queued" });
  });

  app.post("/ingest/pos", async (req, reply) => {
    const contribution = parseWithSchema(contributionSchema, req.body);
    await recordPosTransaction({
      prisma,
      orgId: contribution.orgId,
      amount: contribution.amount,
      actorId: contribution.actorId,
      payload: contribution.payload,
      idempotencyKey: req.headers["idempotency-key"] as string | undefined,
    });
    reply.code(202).send({ status: "queued" });
  });

  app.post("/compliance/precheck", async (req, reply) => {
    const body = parseWithSchema(precheckSchema, req.body);
    const orgId = body.orgId ?? (req.user as any)?.orgId;
    if (!orgId) {
      reply.code(400).send({ error: "org_missing" });
      return;
    }

    const latest = await prisma.basCycle.findFirst({
      where: { orgId, lodgedAt: null },
      orderBy: { periodEnd: "desc" },
    });
    if (!latest) {
      reply.code(404).send({ error: "bas_cycle_missing" });
      return;
    }

    const summary = await summarizeContributions(prisma, orgId);
    const result: Record<string, unknown> = {
      orgId,
      cycleId: latest.id,
      paygwRequired: Number(latest.paygwRequired),
      gstRequired: Number(latest.gstRequired),
      paygwSecured: summary.paygwSecured,
      gstSecured: summary.gstSecured,
      cycleStart: latest.periodStart,
      cycleEnd: latest.periodEnd,
    };

    try {
      await ensureDesignatedAccountCoverage(
        prisma,
        orgId,
        "PAYGW_BUFFER",
        Number(latest.paygwRequired),
      );
      await ensureDesignatedAccountCoverage(
        prisma,
        orgId,
        "GST_BUFFER",
        Number(latest.gstRequired),
      );
      reply.send({ ...result, status: "ready" });
    } catch (error) {
      reply.code(409).send({
        ...result,
        status: "shortfall",
        error: error instanceof Error ? error.message : "shortfall_detected",
        errorCode: (error as any)?.code ?? "designated_shortfall",
      });
    }
  });

  app.get("/compliance/status", async (_req, reply) => {
    const orgId = (_req.user as any)?.orgId;
    if (!orgId) {
      reply.code(400).send({ error: "org_missing" });
      return;
    }
    const accountPromises = (["PAYGW_BUFFER", "GST_BUFFER"] as const).map(
      async (type) => {
        try {
          const snapshot = await reconcileAccountSnapshot(prisma, orgId, type);
          return {
            type,
            balance: snapshot.balance,
            updatedAt: snapshot.updatedAt,
            error: null,
          };
        } catch (accountError) {
          return {
            type,
            balance: 0,
            updatedAt: new Date(0),
            error: accountError instanceof Error
              ? accountError.message
              : "account_unavailable",
          };
        }
      },
    );
    const accounts = await Promise.all(accountPromises);
    const alerts = await prisma.alert.findMany({
      where: { orgId, type: "DESIGNATED_FUNDS_SHORTFALL", resolvedAt: null },
      orderBy: { createdAt: "desc" },
    });
    const summary = await summarizeContributions(prisma, orgId);

    reply.send({
      accounts: accounts.map((account) => ({
        type: account.type,
        balance: account.balance,
        updatedAt: account.updatedAt,
        error: account.error,
      })),
      contributions: summary,
      alerts: alerts.map((alert) => ({
        id: alert.id,
        message: alert.message,
        severity: alert.severity,
        since: alert.createdAt,
      })),
    });
  });
};

export default registerComplianceMonitorRoutes;
