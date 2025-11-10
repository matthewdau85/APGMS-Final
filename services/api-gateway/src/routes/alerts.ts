import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticateRequest, type Role } from "../lib/auth.js";
import { prisma } from "../db.js";
import { parseWithSchema } from "../lib/validation.js";
import { recordAuditLog } from "../lib/audit.js";
import { metrics } from "../observability/metrics.js";

const decisionSchema = z.object({
  reviewerId: z.string().min(1, "reviewerId required"),
  reviewerEmail: z.string().email().optional(),
  approvalStatus: z.enum(["APPROVED", "REJECTED", "OVERRIDDEN"]),
  overrideNote: z.string().trim().optional(),
  decidedAt: z.string().datetime().optional(),
});

const resolveSchema = z.object({
  note: z.string().min(1),
  mfaCode: z.string().optional(),
  decision: decisionSchema.optional(),
});

type ResolveBody = z.infer<typeof resolveSchema>;

type FastifyGuard = (
  req: FastifyRequest,
  reply: FastifyReply,
) => Promise<void> | void;

const HIGH_RISK_EVENT_TYPE = "ALERT";

function buildGuard(app: FastifyInstance, roles: readonly Role[] = []): FastifyGuard {
  return async (req, reply) => {
    await authenticateRequest(app, req, reply, roles);
  };
}

export async function registerAlertRoutes(app: FastifyInstance) {
  const guard = (roles: readonly Role[] = []) => ({ preHandler: buildGuard(app, roles) });

  app.get(
    "/alerts",
    guard([]),
    async (req, reply) => {
      const principal: any = (req as any).user;
      const orgId: string = principal?.orgId;

      const alerts = await prisma.alert.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
      });

      const alertIds = alerts.map((alert) => alert.id);
      const decisions = alertIds.length
        ? await prisma.highRiskDecision.findMany({
            where: { orgId, eventType: HIGH_RISK_EVENT_TYPE, eventId: { in: alertIds } },
            orderBy: { decidedAt: "desc" },
          })
        : [];

      const decisionsByAlert = new Map<string, typeof decisions>();
      for (const entry of decisions) {
        const list = decisionsByAlert.get(entry.eventId) ?? [];
        list.push(entry);
        decisionsByAlert.set(entry.eventId, list);
      }

      reply.send({
        alerts: alerts.map((alert) => ({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          createdAt: alert.createdAt,
          resolved: Boolean(alert.resolvedAt),
          resolvedAt: alert.resolvedAt,
          resolutionNote: alert.resolutionNote,
          decisions: (decisionsByAlert.get(alert.id) ?? []).map((decision) => ({
            id: decision.id,
            reviewerId: decision.reviewerId,
            reviewerEmail: decision.reviewerEmail,
            approvalStatus: decision.approvalStatus,
            overrideNote: decision.overrideNote,
            decidedAt: decision.decidedAt,
          })),
        })),
      });
    },
  );

  app.post<{
    Params: { id: string };
    Body: ResolveBody;
  }>(
    "/alerts/:id/resolve",
    guard([]),
    async (req, reply) => {
      const principal: any = (req as any).user;
      const orgId: string = principal?.orgId;
      const actorId: string = principal?.id;
      const alertId = req.params.id;

      const alert = await prisma.alert.findUnique({ where: { id: alertId } });
      if (!alert || alert.orgId !== orgId) {
        reply.code(404).send({ error: { code: "alert_not_found" } });
        return;
      }

      if (alert.resolvedAt) {
        reply.code(409).send({ error: { code: "alert_already_resolved" } });
        return;
      }

      const body = parseWithSchema(resolveSchema, req.body);
      const requiresDecision = alert.severity?.toUpperCase() === "HIGH";
      if (requiresDecision && !body.decision) {
        reply.code(400).send({
          error: {
            code: "decision_required",
            message: "High-risk alert resolutions require reviewer approval metadata",
          },
        });
        return;
      }
      const now = new Date();

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.alert.update({
          where: { id: alertId },
          data: {
            resolvedAt: now,
            resolutionNote: body.note.trim(),
          },
        });

        let decisionRecord: null | {
          id: string;
          decidedAt: Date;
          approvalStatus: string;
        } = null;

        if (body.decision) {
          const decidedAt = body.decision.decidedAt ? new Date(body.decision.decidedAt) : now;
          const created = await tx.highRiskDecision.create({
            data: {
              orgId,
              eventType: HIGH_RISK_EVENT_TYPE,
              eventId: alertId,
              reviewerId: body.decision.reviewerId,
              reviewerEmail: body.decision.reviewerEmail ?? null,
              approvalStatus: body.decision.approvalStatus,
              overrideNote: body.decision.overrideNote ?? null,
              decidedAt,
              metadata: {
                override: body.decision.approvalStatus === "OVERRIDDEN",
              },
            },
          });
          decisionRecord = {
            id: created.id,
            decidedAt: created.decidedAt,
            approvalStatus: created.approvalStatus,
          };
        }

        return { updated, decisionRecord };
      });

      let auditEntry = null;
      if (result.decisionRecord) {
        auditEntry = await recordAuditLog({
          orgId,
          actorId,
          action: "highRisk.alert.decision",
          metadata: {
            alertId,
            approvalStatus: result.decisionRecord.approvalStatus,
            reviewerId: body.decision?.reviewerId,
          },
        });

        if (auditEntry) {
          await prisma.highRiskDecision.update({
            where: { id: result.decisionRecord.id },
            data: { auditLogId: auditEntry.id },
          });
        }
      } else {
        await recordAuditLog({
          orgId,
          actorId,
          action: "alert.resolve",
          metadata: { alertId },
        });
      }

      await prisma.forensicLog.create({
        data: {
          orgId,
          actorId,
          category: "alert_resolve",
          message: `Alert ${alertId} resolved`,
          payload: {
            highRisk: Boolean(result.decisionRecord),
            approvalStatus: result.decisionRecord?.approvalStatus ?? null,
          },
        },
      });

      metrics.securityEventTotal.labels("alert_resolve", result.decisionRecord ? "approved" : "standard").inc();

      reply.send({
        alert: {
          id: result.updated.id,
          resolved: Boolean(result.updated.resolvedAt),
          resolvedAt: result.updated.resolvedAt,
          resolutionNote: result.updated.resolutionNote,
        },
        decision: result.decisionRecord
          ? {
              id: result.decisionRecord.id,
              approvalStatus: result.decisionRecord.approvalStatus,
              decidedAt: result.decisionRecord.decidedAt,
              auditLogId: auditEntry?.id ?? null,
            }
          : null,
      });
    },
  );
}

export default registerAlertRoutes;
