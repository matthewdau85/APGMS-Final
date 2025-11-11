import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { authenticateRequest } from "../lib/auth.js";
import { prisma } from "../db.js";
import {
  evaluateBasReadiness,
  evaluatePlanCompliance,
} from "../lib/ml-policy.js";
import { hasApprovedDecision } from "../lib/ml-decisions.js";

const paymentPlanSchema = z.object({
  basCycleId: z.string().min(1),
  reason: z.string().min(3),
  weeklyAmount: z.number().positive(),
  startDate: z.string().min(4),
  notes: z.string().optional(),
});

const lodgeSchema = z.object({
  mfaCode: z.string().optional(),
});

const paymentPlanQuerySchema = z.object({
  basCycleId: z.string().min(1).optional(),
});

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === "number") {
    return value;
  }
  return Number.parseFloat(value.toString());
}

export const registerBasRoutes: FastifyPluginAsync = async (app) => {
  app.get("/bas/preview", async (request, reply) => {
    const principal = await authenticateRequest(app, request, reply, ["admin", "finance"]);
    if (!principal) {
      return;
    }

    const basCycle = await prisma.basCycle.findFirst({
      where: { orgId: principal.orgId, lodgedAt: null },
      orderBy: { periodEnd: "desc" },
    });

    const evaluation = await evaluateBasReadiness(principal.orgId);
    const issuedAt = new Date(evaluation.issuedAt);
    const overrideApproved = evaluation.policyPassed
      ? false
      : await hasApprovedDecision(principal.orgId, "shortfall", issuedAt);
    const paygwRequired = decimalToNumber(basCycle?.paygwRequired);
    const paygwSecured = decimalToNumber(basCycle?.paygwSecured);
    const gstRequired = decimalToNumber(basCycle?.gstRequired);
    const gstSecured = decimalToNumber(basCycle?.gstSecured);

    const paygwShortfall = Math.max(0, paygwRequired - paygwSecured);
    const gstShortfall = Math.max(0, gstRequired - gstSecured);

    const blockers: string[] = [];
    if (paygwShortfall > 0) blockers.push("PAYGW designated accounts under target");
    if (gstShortfall > 0) blockers.push("GST designated accounts under target");
    if (!evaluation.policyPassed && !overrideApproved)
      blockers.push("Readiness ML gate requires approval or mitigation");

    reply.send({
      basCycleId: basCycle?.id ?? null,
      periodStart: basCycle ? basCycle.periodStart.toISOString() : null,
      periodEnd: basCycle ? basCycle.periodEnd.toISOString() : null,
      paygw: {
        required: paygwRequired,
        secured: paygwSecured,
        status: paygwShortfall > 0 ? "BLOCKED" : "READY",
      },
      gst: {
        required: gstRequired,
        secured: gstSecured,
        status: gstShortfall > 0 ? "BLOCKED" : "READY",
      },
      overallStatus:
        (evaluation.policyPassed || overrideApproved) && basCycle?.overallStatus === "READY"
          ? "READY"
          : overrideApproved
            ? "OVERRIDDEN"
            : "BLOCKED",
      blockers,
      risk: {
        scenario: "shortfall",
        score: evaluation.score,
        policyThreshold: evaluation.policyThreshold,
        modelThreshold: evaluation.model.threshold,
        modelId: evaluation.model.id,
        modelVersion: evaluation.model.version,
        policyPassed: evaluation.policyPassed,
        contributions: evaluation.contributions,
        issuedAt: evaluation.issuedAt,
      },
    });
  });

  app.post("/bas/lodge", async (request, reply) => {
    const principal = await authenticateRequest(app, request, reply, ["admin", "finance"]);
    if (!principal) {
      return;
    }

    const body = lodgeSchema.safeParse(request.body ?? {});
    if (!body.success) {
      reply.code(400).send({ error: "invalid_request", details: body.error.flatten() });
      return;
    }

    const evaluation = await evaluateBasReadiness(principal.orgId);
    const issuedAt = new Date(evaluation.issuedAt);

    if (!evaluation.policyPassed) {
      const approved = await hasApprovedDecision(principal.orgId, "shortfall", issuedAt);
      if (!approved) {
        reply.code(409).send({
          error: {
            code: "bas_shortfall_blocked",
            message: "BAS lodgment blocked: ML readiness gate not approved",
            evaluation,
          },
        });
        return;
      }
    }

    const basCycle = await prisma.basCycle.findFirst({
      where: { orgId: principal.orgId, lodgedAt: null },
      orderBy: { periodEnd: "desc" },
    });

    if (!basCycle) {
      reply.code(404).send({ error: { code: "bas_cycle_missing", message: "No active BAS cycle" } });
      return;
    }

    const lodgedAt = new Date();
    const updated = await prisma.basCycle.update({
      where: { id: basCycle.id },
      data: {
        lodgedAt,
        overallStatus: evaluation.policyPassed ? "READY" : "OVERRIDDEN",
      },
      select: { id: true, overallStatus: true, lodgedAt: true },
    });

    reply.send({
      basCycle: {
        id: updated.id,
        status: updated.overallStatus,
        lodgedAt: updated.lodgedAt?.toISOString() ?? lodgedAt.toISOString(),
      },
    });
  });

  app.get("/bas/payment-plan-request", async (request, reply) => {
    const principal = await authenticateRequest(app, request, reply, ["admin", "finance"]);
    if (!principal) {
      return;
    }

    const query = paymentPlanQuerySchema.safeParse(request.query ?? {});
    if (!query.success) {
      reply.code(400).send({ error: "invalid_query", details: query.error.flatten() });
      return;
    }

    const where = {
      orgId: principal.orgId,
      ...(query.data.basCycleId ? { basCycleId: query.data.basCycleId } : {}),
    };

    const requestRow = await prisma.paymentPlanRequest.findFirst({
      where,
      orderBy: { requestedAt: "desc" },
    });

    reply.send({
      request: requestRow
        ? {
            id: requestRow.id,
            basCycleId: requestRow.basCycleId,
            requestedAt: requestRow.requestedAt.toISOString(),
            status: requestRow.status,
            reason: requestRow.reason,
            details: requestRow.detailsJson as Record<string, unknown>,
            resolvedAt: requestRow.resolvedAt?.toISOString() ?? null,
          }
        : null,
    });
  });

  app.post("/bas/payment-plan-request", async (request, reply) => {
    const principal = await authenticateRequest(app, request, reply, ["admin", "finance"]);
    if (!principal) {
      return;
    }

    const parsed = paymentPlanSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
      return;
    }

    const evaluation = await evaluatePlanCompliance(principal.orgId);
    const issuedAt = new Date(evaluation.issuedAt);
    if (!evaluation.policyPassed) {
      const approved = await hasApprovedDecision(principal.orgId, "plan", issuedAt);
      if (!approved) {
        reply.code(409).send({
          error: {
            code: "payment_plan_blocked",
            message: "Payment plan requires override due to compliance risk",
            evaluation,
          },
        });
        return;
      }
    }

    const created = await prisma.paymentPlanRequest.create({
      data: {
        orgId: principal.orgId,
        basCycleId: parsed.data.basCycleId,
        reason: parsed.data.reason,
        detailsJson: {
          weeklyAmount: parsed.data.weeklyAmount,
          startDate: parsed.data.startDate,
          notes: parsed.data.notes ?? null,
        },
      },
      select: {
        id: true,
        basCycleId: true,
        requestedAt: true,
        status: true,
        reason: true,
        detailsJson: true,
        resolvedAt: true,
      },
    });

    reply.code(201).send({
      request: {
        id: created.id,
        basCycleId: created.basCycleId,
        requestedAt: created.requestedAt.toISOString(),
        status: created.status,
        reason: created.reason,
        details: created.detailsJson as Record<string, unknown>,
        resolvedAt: created.resolvedAt?.toISOString() ?? null,
      },
    });
  });
};
