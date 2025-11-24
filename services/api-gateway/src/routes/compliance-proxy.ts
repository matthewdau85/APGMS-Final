// services/api-gateway/src/routes/compliance-proxy.ts
import { createHash } from "crypto";
import { type FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { authGuard } from "../auth.js";
import { prisma } from "../db.js";
import type { EvidenceArtifact } from "@prisma/client";

const formatPeriod = (start: Date, end: Date): string =>
  `${start.toISOString().slice(0, 10)}-${end.toISOString().slice(0, 10)}`;

const toNumber = (value: unknown): number =>
  typeof value === "number" ? value : Number(value ?? 0);

const redactArtifact = (artifact: EvidenceArtifact) => ({
  id: artifact.id,
  kind: artifact.kind,
  sha256: artifact.sha256,
  wormUri: artifact.wormUri,
  createdAt: artifact.createdAt.toISOString(),
});

export const registerComplianceProxy: FastifyPluginAsync = async (app) => {
  app.get("/compliance/report", { preHandler: [authGuard] }, async (req, reply) => {
    const orgId = (req.user as any)?.orgId;
    if (!orgId) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }

    const [basCycles, paymentPlans, openHighSeverity, resolvedThisQuarter, designatedAccounts] =
      await Promise.all([
        prisma.basCycle.findMany({
          where: { orgId },
          orderBy: { periodStart: "desc" },
        }),
        prisma.paymentPlanRequest.findMany({
          where: { orgId },
          orderBy: { requestedAt: "desc" },
        }),
        prisma.alert.count({
          where: { orgId, severity: "HIGH", resolvedAt: null },
        }),
        prisma.alert.count({
          where: {
            orgId,
            resolvedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
          },
        }),
        prisma.designatedAccount.findMany({ where: { orgId } }),
      ]);

    const basHistory = basCycles.map((cycle) => ({
      period: formatPeriod(cycle.periodStart, cycle.periodEnd),
      lodgedAt: cycle.lodgedAt?.toISOString() ?? null,
      status: cycle.overallStatus,
      notes: `PAYGW ${toNumber(cycle.paygwSecured)} / ${toNumber(
        cycle.paygwRequired,
      )} | GST ${toNumber(cycle.gstSecured)} / ${toNumber(cycle.gstRequired)}`,
    }));

    const paymentPlanHistory = paymentPlans.map((plan) => ({
      id: plan.id,
      basCycleId: plan.basCycleId,
      requestedAt: plan.requestedAt.toISOString(),
      status: plan.status,
      reason: plan.reason,
      details: plan.detailsJson ?? {},
      resolvedAt: plan.resolvedAt?.toISOString() ?? null,
    }));

    const totals = designatedAccounts.reduce(
      (acc, account) => {
        if (account.type === "PAYGW") {
          acc.paygw += Number(account.balance ?? 0);
        } else if (account.type === "GST") {
          acc.gst += Number(account.balance ?? 0);
        }
        return acc;
      },
      { paygw: 0, gst: 0 },
    );

    reply.send({
      orgId,
      basHistory,
      paymentPlanHistory,
      openHighSeverity,
      resolvedThisQuarter,
      totals,
    });
  });

  app.get("/admin/export/:orgId", { preHandler: [authGuard] }, async (req, reply) => {
    const principalOrgId = (req.user as any)?.orgId;
    if (!principalOrgId) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }

    const paramsSchema = z.object({ orgId: z.string().min(1) });
    const parsed = paramsSchema.safeParse(req.params ?? {});
    if (!parsed.success) {
      reply
        .code(400)
        .send({ error: { code: "invalid_params", details: parsed.error.flatten() } });
      return;
    }

    const orgId = parsed.data.orgId;
    if (orgId !== principalOrgId) {
      reply.code(403).send({ error: "forbidden" });
      return;
    }

    const org = await prisma.org.findUnique({ where: { id: orgId } });
    const userRecord =
      (
        await prisma.user.findMany({
          where: { orgId },
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            createdAt: true,
            org: { select: { id: true, name: true } },
          },
        })
      )[0] ?? null;

    if (!org || !userRecord) {
      reply.code(404).send({ error: "org_not_found" });
      return;
    }

    const bankLinesCount = await prisma.bankLine.count({ where: { orgId } });
    const exportedAt = new Date().toISOString();

    reply.send({
      org: { id: org.id, name: org.name },
      user: {
        id: userRecord.id,
        email: userRecord.email,
        createdAt: userRecord.createdAt.toISOString(),
      },
      relationships: {
        bankLinesCount,
      },
      exportedAt,
    });
  });

  app.post("/compliance/evidence", { preHandler: [authGuard] }, async (req, reply) => {
    const orgId = (req.user as any)?.orgId;
    if (!orgId) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }

    const artifactBodySchema = z.object({
      kind: z.string().min(1),
      wormUri: z.string().url(),
      payload: z.record(z.any()),
    });

    const parsedBody = artifactBodySchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      reply
        .code(400)
        .send({ error: { code: "invalid_body", details: parsedBody.error.flatten() } });
      return;
    }

    const payloadJson = JSON.stringify(parsedBody.data.payload);
    const sha256 = createHash("sha256").update(payloadJson).digest("hex");

    const artifact = await prisma.evidenceArtifact.create({
      data: {
        orgId,
        kind: parsedBody.data.kind,
        sha256,
        wormUri: parsedBody.data.wormUri,
        payload: parsedBody.data.payload,
      },
    });
    reply.send({ artifact: { id: artifact.id, sha256 } });
  });

  app.get("/compliance/evidence/:artifactId", { preHandler: [authGuard] }, async (req, reply) => {
    const artifactParamsSchema = z.object({ artifactId: z.string().min(1) });
    const orgId = (req.user as any)?.orgId;
    if (!orgId) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }
    const parsed = artifactParamsSchema.safeParse(req.params ?? {});
    if (!parsed.success) {
      reply
        .code(400)
        .send({ error: { code: "invalid_params", details: parsed.error.flatten() } });
      return;
    }

    const artifact = await prisma.evidenceArtifact.findFirst({
      where: { id: parsed.data.artifactId, orgId },
    });
    if (!artifact) {
      reply.code(404).send({ error: "artifact_not_found" });
      return;
    }
    reply.send({ artifact: redactArtifact(artifact) });
  });
};

export default registerComplianceProxy;
