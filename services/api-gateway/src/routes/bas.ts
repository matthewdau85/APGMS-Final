import { Prisma, type BasCycle } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { authGuard } from "../auth.js";
import { prisma } from "../db.js";
import { recordAuditLog } from "../lib/audit.js";
import { parseWithSchema } from "../lib/validation.js";
import {
  BasLodgeBodySchema,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from "@apgms/shared";
import {
  getDesignatedAccountSummary,
  type DesignatedReconciliationSummary,
} from "../../../../domain/policy/designated-accounts.js";
import {
  requireRecentVerification,
  verifyChallenge,
} from "../security/mfa.js";

type BasRouteDependencies = {
  prisma: typeof prisma;
  getDesignatedSummary: (
    context: { prisma: typeof prisma },
    orgId: string,
  ) => Promise<DesignatedReconciliationSummary>;
  recordAuditLog: typeof recordAuditLog;
  requireRecentVerification: typeof requireRecentVerification;
  verifyChallenge: typeof verifyChallenge;
};

const defaultDependencies: BasRouteDependencies = {
  prisma,
  getDesignatedSummary: (context, orgId) =>
    getDesignatedAccountSummary(context, orgId),
  recordAuditLog,
  requireRecentVerification,
  verifyChallenge,
};

const EPSILON = 0.005;

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatAmount(value: number): string {
  return `$${roundTwo(value).toFixed(2)}`;
}

type BasPreview = {
  basCycleId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  paygw: { required: number; secured: number; status: string };
  gst: { required: number; secured: number; status: string };
  overallStatus: string;
  blockers: string[];
};

export async function registerBasRoutes(
  app: FastifyInstance,
  overrides: Partial<BasRouteDependencies> = {},
): Promise<void> {
  const deps: BasRouteDependencies = { ...defaultDependencies, ...overrides };

  const ensureStepUp = async (
    userId: string,
    mfaCode: string | undefined,
  ): Promise<void> => {
    if (deps.requireRecentVerification(userId)) {
      return;
    }
    if (!mfaCode) {
      throw forbidden(
        "mfa_required",
        "Multi-factor verification required to perform this action",
      );
    }
    const result = await deps.verifyChallenge(userId, mfaCode);
    if (!result.success) {
      throw unauthorized("mfa_invalid", "MFA verification failed");
    }
  };

  const loadBasState = async (
    orgId: string,
  ): Promise<{ preview: BasPreview; cycle: BasCycle | null }> => {
    const cycle = await deps.prisma.basCycle.findFirst({
      where: { orgId, lodgedAt: null },
      orderBy: { periodEnd: "desc" },
    });

    const summary = await deps.getDesignatedSummary({
      prisma: deps.prisma,
    }, orgId);

    const paygwRequired = cycle ? Number(cycle.paygwRequired ?? 0) : 0;
    const gstRequired = cycle ? Number(cycle.gstRequired ?? 0) : 0;
    const paygwSecured = summary.totals.paygw;
    const gstSecured = summary.totals.gst;

    const paygwStatus = !cycle
      ? "NOT_SCHEDULED"
      : paygwSecured + EPSILON >= paygwRequired
        ? "READY"
        : "BLOCKED";
    const gstStatus = !cycle
      ? "NOT_SCHEDULED"
      : gstSecured + EPSILON >= gstRequired
        ? "READY"
        : "BLOCKED";

    const blockers: string[] = [];
    if (cycle) {
      if (paygwStatus !== "READY") {
        blockers.push(
          `PAYGW designated balance shortfall: required ${formatAmount(paygwRequired)}, secured ${formatAmount(paygwSecured)}`,
        );
      }
      if (gstStatus !== "READY") {
        blockers.push(
          `GST designated balance shortfall: required ${formatAmount(gstRequired)}, secured ${formatAmount(gstSecured)}`,
        );
      }
    }

    const preview: BasPreview = {
      basCycleId: cycle?.id ?? null,
      periodStart: cycle ? cycle.periodStart.toISOString() : null,
      periodEnd: cycle ? cycle.periodEnd.toISOString() : null,
      paygw: {
        required: roundTwo(paygwRequired),
        secured: roundTwo(paygwSecured),
        status: paygwStatus,
      },
      gst: {
        required: roundTwo(gstRequired),
        secured: roundTwo(gstSecured),
        status: gstStatus,
      },
      overallStatus:
        cycle && paygwStatus === "READY" && gstStatus === "READY"
          ? "READY"
          : cycle
            ? "BLOCKED"
            : "NOT_SCHEDULED",
      blockers,
    };

    return { preview, cycle };
  };

  app.get(
    "/bas/preview",
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user) {
        throw unauthorized("unauthorized", "Missing user context");
      }

      const { preview } = await loadBasState(user.orgId);
      reply.send(preview);
    },
  );

  app.post(
    "/bas/lodge",
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user) {
        throw unauthorized("unauthorized", "Missing user context");
      }

      const body = parseWithSchema(BasLodgeBodySchema, request.body);
      const { preview, cycle } = await loadBasState(user.orgId);

      if (!cycle) {
        throw notFound("bas_cycle_not_found", "No active BAS cycle to lodge");
      }

      await ensureStepUp(user.sub, body.mfaCode);

      if (preview.overallStatus !== "READY") {
        throw conflict(
          "bas_shortfall",
          "BAS obligations are not fully secured",
        );
      }

      const lodgedAt = new Date();

      const updated = await deps.prisma.basCycle.update({
        where: { id: cycle.id },
        data: {
          lodgedAt,
          overallStatus: "LODGED",
          paygwSecured: new Prisma.Decimal(preview.paygw.secured),
          gstSecured: new Prisma.Decimal(preview.gst.secured),
        },
      });

      await deps.recordAuditLog({
        orgId: user.orgId,
        actorId: user.sub,
        action: "bas.lodged",
        metadata: {
          basCycleId: updated.id,
          lodgedAt: lodgedAt.toISOString(),
          paygwSecured: preview.paygw.secured,
          gstSecured: preview.gst.secured,
        },
      });

      reply.send({
        basCycle: {
          id: updated.id,
          status: updated.overallStatus,
          lodgedAt: (updated.lodgedAt ?? lodgedAt).toISOString(),
        },
      });
    },
  );
}

export default registerBasRoutes;
