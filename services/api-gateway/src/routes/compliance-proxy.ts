import { type FastifyPluginAsync, type FastifyRequest, type FastifyReply } from "fastify";

import { prisma } from "../db.js";

const formatPeriod = (start: Date, end: Date): string =>
  `${start.toISOString().slice(0, 10)}-${end.toISOString().slice(0, 10)}`;

const toNumber = (value: unknown): number => (typeof value === "number" ? value : Number(value ?? 0));

const ensureToken = (req: FastifyRequest, reply: FastifyReply) => {
  const token = process.env.APGMS_API_TOKEN;
  const header = (req.headers.authorization ?? "").toString().replace(/^Bearer\s+/i, "");
  if (!token || header !== token) {
    reply.code(401).send({ error: "unauthorized" });
    return false;
  }
  return true;
};

const getOrgId = () => process.env.APGMS_ORG_ID ?? "dev-org";

export const registerComplianceProxy: FastifyPluginAsync = async (app) => {
  app.get("/compliance/report", async (req, reply) => {
    if (!ensureToken(req, reply)) return;
    const orgId = getOrgId();

    const [
      basCycles,
      paymentPlans,
      openHighSeverity,
      resolvedThisQuarter,
      designatedAccounts,
    ] = await Promise.all([
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
      notes: `PAYGW ${toNumber(cycle.paygwSecured)} / ${toNumber(cycle.paygwRequired)} · GST ${toNumber(
        cycle.gstSecured,
      )} / ${toNumber(cycle.gstRequired)}`,
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

  app.get("/admin/export/:orgId", async (req, reply) => {
    if (!ensureToken(req, reply)) return;
    const orgId = (req.params as { orgId: string }).orgId;
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

  app.post("/compliance/evidence", async (req, reply) => {
    if (!ensureToken(req, reply)) return;
    const orgId = getOrgId();
    const artifact = await prisma.evidenceArtifact.create({
      data: {
        orgId,
        kind: "designated-reconciliation",
        sha256: "mock",
        wormUri: "mock://evidence",
        payload: {},
      },
    });
    reply.send({ artifact: { id: artifact.id } });
  });

  app.get("/compliance/evidence/:artifactId", async (req, reply) => {
    if (!ensureToken(req, reply)) return;
    const artifact = await prisma.evidenceArtifact.findUnique({
      where: { id: (req.params as { artifactId: string }).artifactId },
    });
    if (!artifact) {
      reply.code(404).send({ error: "artifact_not_found" });
      return;
    }
    reply.send({ artifact });
  });
};

export default registerComplianceProxy;
