import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticateRequest, type Role } from "../lib/auth.js";
import { prisma } from "../db.js";
import { parseWithSchema } from "../lib/validation.js";
import { recordAuditLog } from "../lib/audit.js";
import { metrics } from "../observability/metrics.js";
import { executeBasLodgmentIntegration } from "../utils/bas-integration.js";

const decisionSchema = z.object({
  reviewerId: z.string().min(1),
  reviewerEmail: z.string().email().optional(),
  approvalStatus: z.enum(["APPROVED", "OVERRIDDEN", "DEFERRED"]),
  overrideNote: z.string().optional(),
  decidedAt: z.string().datetime().optional(),
  deferredRemittanceUntil: z.string().datetime().optional(),
});

const lodgeSchema = z.object({
  mfaCode: z.string().optional(),
  decision: decisionSchema,
});

type LodgeBody = z.infer<typeof lodgeSchema>;

type FastifyGuard = (
  req: FastifyRequest,
  reply: FastifyReply,
) => Promise<void> | void;

const HIGH_RISK_EVENT_TYPE = "BAS_LODGMENT";

function buildGuard(app: FastifyInstance, roles: readonly Role[] = []): FastifyGuard {
  return async (req, reply) => {
    await authenticateRequest(app, req, reply, roles);
  };
}

function deriveObligationStatus(required: number, secured: number) {
  if (required <= 0) {
    return "READY";
  }
  if (secured >= required) {
    return "READY";
  }
  if (secured === 0) {
    return "EMPTY";
  }
  return "SHORTFALL";
}

function computeBlockers(
  paygw: { required: number; secured: number },
  gst: { required: number; secured: number },
): string[] {
  const blockers: string[] = [];
  if (paygw.secured < paygw.required) {
    blockers.push(
      `PAYGW designated account shortfall of ${paygw.required - paygw.secured} AUD`,
    );
  }
  if (gst.secured < gst.required) {
    blockers.push(
      `GST designated account shortfall of ${gst.required - gst.secured} AUD`,
    );
  }
  return blockers;
}

async function refreshFallbackGauge(orgId: string) {
  const queued = await prisma.basFallbackTask.count({
    where: { orgId, status: "queued" },
  });
  metrics.basFallbackQueueDepth.set(queued);
}

export async function registerBasRoutes(app: FastifyInstance) {
  const guard = (roles: readonly Role[] = []) => ({ preHandler: buildGuard(app, roles) });

  app.get(
    "/bas/preview",
    guard([]),
    async (req, reply) => {
      const principal: any = (req as any).user;
      const orgId: string = principal?.orgId;

      const basCycle = await prisma.basCycle.findFirst({
        where: { orgId },
        orderBy: { periodStart: "asc" },
      });

      if (!basCycle) {
        reply.send({
          basCycleId: null,
          periodStart: null,
          periodEnd: null,
          paygw: { required: 0, secured: 0, status: "EMPTY" },
          gst: { required: 0, secured: 0, status: "EMPTY" },
          overallStatus: "NOT_SCHEDULED",
          blockers: [],
          lastDecision: null,
        });
        return;
      }

      const paygwRequired = Number(basCycle.paygwRequired ?? 0);
      const paygwSecured = Number(basCycle.paygwSecured ?? 0);
      const gstRequired = Number(basCycle.gstRequired ?? 0);
      const gstSecured = Number(basCycle.gstSecured ?? 0);

      const paygw = {
        required: paygwRequired,
        secured: paygwSecured,
        status: deriveObligationStatus(paygwRequired, paygwSecured),
      };
      const gst = {
        required: gstRequired,
        secured: gstSecured,
        status: deriveObligationStatus(gstRequired, gstSecured),
      };

      const blockers = computeBlockers(paygw, gst);
      const ready = blockers.length === 0;

      const lastDecision = await prisma.highRiskDecision.findFirst({
        where: { orgId, eventType: HIGH_RISK_EVENT_TYPE, eventId: basCycle.id },
        orderBy: { decidedAt: "desc" },
      });

      reply.send({
        basCycleId: basCycle.id,
        periodStart: basCycle.periodStart,
        periodEnd: basCycle.periodEnd,
        paygw,
        gst,
        overallStatus: ready ? "READY" : "BLOCKED",
        blockers,
        lastDecision: lastDecision
          ? {
              id: lastDecision.id,
              approvalStatus: lastDecision.approvalStatus,
              decidedAt: lastDecision.decidedAt,
              reviewerId: lastDecision.reviewerId,
            }
          : null,
      });
    },
  );

  app.post<{ Body: LodgeBody }>(
    "/bas/lodge",
    guard([]),
    async (req, reply) => {
      const principal: any = (req as any).user;
      const orgId: string = principal?.orgId;
      const actorId: string = principal?.id;

      const body = parseWithSchema(lodgeSchema, req.body);

      const basCycle = await prisma.basCycle.findFirst({
        where: { orgId },
        orderBy: { periodStart: "asc" },
      });

      if (!basCycle) {
        reply.code(404).send({ error: { code: "bas_cycle_not_found" } });
        return;
      }

      if (basCycle.lodgedAt) {
        reply.code(409).send({ error: { code: "bas_already_lodged" } });
        return;
      }

      const decision = body.decision;
      const decidedAt = decision.decidedAt ? new Date(decision.decidedAt) : new Date();

      const createdDecision = await prisma.highRiskDecision.create({
        data: {
          orgId,
          eventType: HIGH_RISK_EVENT_TYPE,
          eventId: basCycle.id,
          reviewerId: decision.reviewerId,
          reviewerEmail: decision.reviewerEmail ?? null,
          approvalStatus: decision.approvalStatus,
          overrideNote: decision.overrideNote ?? null,
          decidedAt,
          metadata: {
            deferredRemittanceUntil: decision.deferredRemittanceUntil ?? null,
          },
        },
      });

      let integrationError: Error | null = null;
      try {
        await executeBasLodgmentIntegration({
          basCycleId: basCycle.id,
          orgId,
        });
        metrics.integrationEventsTotal.labels("bas_lodgment", "success").inc();
      } catch (error) {
        integrationError = error as Error;
        metrics.integrationEventsTotal.labels("bas_lodgment", "failed").inc();
      }

      const now = new Date();
      const result = await prisma.$transaction(async (tx) => {
        let updatedCycle = null;
        let fallbackTask = null;

        if (!integrationError) {
          updatedCycle = await tx.basCycle.update({
            where: { id: basCycle.id },
            data: {
              lodgedAt: now,
              overallStatus: "LODGE_INITIATED",
            },
          });
        } else {
          fallbackTask = await tx.basFallbackTask.create({
            data: {
              orgId,
              basCycleId: basCycle.id,
              trigger: "lodgment",
              payload: {
                reviewerId: decision.reviewerId,
                approvalStatus: decision.approvalStatus,
                overrideNote: decision.overrideNote ?? null,
                deferredRemittanceUntil: decision.deferredRemittanceUntil ?? null,
              },
              status: "queued",
            },
          });
        }

        return { updatedCycle, fallbackTask };
      });

      const auditEntry = await recordAuditLog({
        orgId,
        actorId,
        action: "highRisk.bas.decision",
        metadata: {
          basCycleId: basCycle.id,
          approvalStatus: decision.approvalStatus,
          fallback: Boolean(result.fallbackTask),
        },
      });

      if (auditEntry) {
        await prisma.highRiskDecision.update({
          where: { id: createdDecision.id },
          data: { auditLogId: auditEntry.id },
        });
      }

      await prisma.forensicLog.create({
        data: {
          orgId,
          actorId,
          category: "bas_lodgment",
          message: integrationError
            ? `BAS lodgment queued for manual processing (${basCycle.id})`
            : `BAS lodgment triggered for cycle ${basCycle.id}`,
          payload: {
            fallback: Boolean(result.fallbackTask),
            integrationError: integrationError?.message ?? null,
          },
        },
      });

      await refreshFallbackGauge(orgId);

      if (integrationError) {
        metrics.securityEventTotal.labels("bas_lodgment", "fallback").inc();
        reply.code(202).send({
          basCycle: {
            id: basCycle.id,
            status: "MANUAL_REQUIRED",
            lodgedAt: null,
          },
          fallbackTask: result.fallbackTask,
          error: { message: integrationError.message },
        });
        return;
      }

      metrics.securityEventTotal.labels("bas_lodgment", "lodged").inc();
      reply.send({
        basCycle: {
          id: result.updatedCycle?.id ?? basCycle.id,
          status: "LODGE_INITIATED",
          lodgedAt: result.updatedCycle?.lodgedAt ?? now,
        },
        decision: {
          id: createdDecision.id,
          approvalStatus: createdDecision.approvalStatus,
          decidedAt: createdDecision.decidedAt,
          auditLogId: auditEntry?.id ?? null,
        },
      });
    },
  );

  app.get(
    "/bas/fallback/tasks",
    guard(["admin", "finance"]),
    async (req, reply) => {
      const principal: any = (req as any).user;
      const orgId: string = principal?.orgId;

      const tasks = await prisma.basFallbackTask.findMany({
        where: { orgId, status: "queued" },
        orderBy: { createdAt: "asc" },
      });

      reply.send({ tasks });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/bas/fallback/tasks/:id/complete",
    guard(["admin", "finance"]),
    async (req, reply) => {
      const principal: any = (req as any).user;
      const orgId: string = principal?.orgId;
      const taskId = req.params.id;

      const task = await prisma.basFallbackTask.findUnique({ where: { id: taskId } });
      if (!task || task.orgId !== orgId) {
        reply.code(404).send({ error: { code: "fallback_task_not_found" } });
        return;
      }

      await prisma.basFallbackTask.update({
        where: { id: taskId },
        data: {
          status: "processed",
          processedAt: new Date(),
        },
      });

      await refreshFallbackGauge(orgId);
      metrics.securityEventTotal.labels("bas_lodgment", "manual_complete").inc();

      reply.send({ ok: true });
    },
  );
}

export default registerBasRoutes;
