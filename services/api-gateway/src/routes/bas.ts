import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { authGuard } from "../auth.js";
import { prisma } from "../db.js";
import { enforceAdminStepUp } from "../security/step-up.js";
import { verifyChallenge } from "../security/mfa.js";

const lodgeBodySchema = z.object({
  mfaCode: z.string().trim().min(6).max(16).optional(),
});

const offlineSubmissionSchema = z.object({
  basCycleId: z.string().min(1),
  reference: z.string().min(1),
  notes: z.string().max(500).optional(),
});

export const registerBasRoutes: FastifyPluginAsync = async (app) => {
  app.get("/bas/preview", { preHandler: authGuard }, async (request, reply) => {
    if (!enforceAdminStepUp(request, reply, "bas.preview")) {
      return;
    }

    const user = (request as any).user!;

    const basCycle = await prisma.basCycle.findFirst({
      where: { orgId: user.orgId },
      orderBy: { periodStart: "desc" },
    });

    if (!basCycle) {
      reply.send({
        basCycleId: null,
        periodStart: null,
        periodEnd: null,
        paygw: { required: 0, secured: 0, status: "missing" },
        gst: { required: 0, secured: 0, status: "missing" },
        overallStatus: "missing",
        blockers: ["No active BAS cycle"],
      });
      return;
    }

    const paygwRequired = Number(basCycle.paygwRequired);
    const paygwSecured = Number(basCycle.paygwSecured);
    const gstRequired = Number(basCycle.gstRequired);
    const gstSecured = Number(basCycle.gstSecured);

    const blockers: string[] = [];
    if (paygwSecured < paygwRequired) {
      blockers.push("PAYGW designated account underfunded");
    }
    if (gstSecured < gstRequired) {
      blockers.push("GST designated account underfunded");
    }

    reply.send({
      basCycleId: basCycle.id,
      periodStart: basCycle.periodStart.toISOString(),
      periodEnd: basCycle.periodEnd.toISOString(),
      paygw: {
        required: paygwRequired,
        secured: paygwSecured,
        status: paygwSecured >= paygwRequired ? "ready" : "shortfall",
      },
      gst: {
        required: gstRequired,
        secured: gstSecured,
        status: gstSecured >= gstRequired ? "ready" : "shortfall",
      },
      overallStatus: blockers.length === 0 ? "ready" : "blocked",
      blockers,
    });
  });

  app.post("/bas/lodge", { preHandler: authGuard }, async (request, reply) => {
    const user = (request as any).user!;
    const body = lodgeBodySchema.safeParse(request.body ?? {});
    if (!body.success) {
      reply.code(400).send({ error: { code: "invalid_body" } });
      return;
    }

    if (body.data.mfaCode) {
      const result = await verifyChallenge(user.sub, body.data.mfaCode);
      if (!result.success) {
        reply.code(401).send({ error: { code: "mfa_invalid" } });
        return;
      }
    }

    if (!enforceAdminStepUp(request, reply, "bas.lodge")) {
      return;
    }

    const basCycle = await prisma.basCycle.findFirst({
      where: { orgId: user.orgId },
      orderBy: { periodStart: "desc" },
    });

    if (!basCycle) {
      reply.code(404).send({ error: { code: "bas_cycle_missing" } });
      return;
    }

    const paygwRequired = Number(basCycle.paygwRequired);
    const paygwSecured = Number(basCycle.paygwSecured);
    const gstRequired = Number(basCycle.gstRequired);
    const gstSecured = Number(basCycle.gstSecured);

    const shortfall = Math.max(0, paygwRequired - paygwSecured) + Math.max(0, gstRequired - gstSecured);

    if (shortfall > 0) {
      const attempt = await prisma.basPaymentAttempt.create({
        data: {
          orgId: user.orgId,
          basCycleId: basCycle.id,
          status: "PENDING",
          attemptCount: 0,
          failureReason: "designated_shortfall",
          nextRunAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      reply.code(409).send({
        error: {
          code: "bas_shortfall",
          message: "Designated accounts must be topped up before BAS lodgment",
        },
        queue: {
          attemptId: attempt.id,
          status: attempt.status,
          nextRunAt: attempt.nextRunAt?.toISOString() ?? null,
        },
      });
      return;
    }

    const lodgedAt = new Date();
    await prisma.$transaction([
      prisma.basCycle.update({
        where: { id: basCycle.id },
        data: { lodgedAt, overallStatus: "lodged" },
      }),
      prisma.basPaymentAttempt.create({
        data: {
          orgId: user.orgId,
          basCycleId: basCycle.id,
          status: "SUCCEEDED",
          attemptCount: 1,
          failureReason: null,
        },
      }),
    ]);

    reply.send({
      basCycle: {
        id: basCycle.id,
        status: "lodged",
        lodgedAt: lodgedAt.toISOString(),
      },
    });
  });

  app.post(
    "/bas/offline-submissions",
    { preHandler: authGuard },
    async (request, reply) => {
      if (!enforceAdminStepUp(request, reply, "bas.offline")) {
        return;
      }

      const user = (request as any).user!;
      const parsed = offlineSubmissionSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: { code: "invalid_body" } });
        return;
      }

      const basCycle = await prisma.basCycle.findUnique({
        where: { id: parsed.data.basCycleId },
      });
      if (!basCycle || basCycle.orgId !== user.orgId) {
        reply.code(404).send({ error: { code: "bas_cycle_missing" } });
        return;
      }

      const record = await prisma.basPaymentAttempt.create({
        data: {
          orgId: user.orgId,
          basCycleId: basCycle.id,
          status: "PENDING",
          offlineFallback: true,
          offlineReference: parsed.data.reference,
          failureReason: parsed.data.notes ?? null,
        },
      });

      reply.code(202).send({
        submission: {
          id: record.id,
          basCycleId: record.basCycleId,
          reference: record.offlineReference,
          status: record.status,
        },
      });
    },
  );
};

export default registerBasRoutes;
