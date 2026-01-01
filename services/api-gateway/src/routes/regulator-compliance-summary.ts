import type { FastifyPluginAsync } from "fastify";
import { computeRegulatorComplianceSummary } from "./regulator-compliance-summary.service.js";

function headerToString(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0].trim() || undefined;
  return undefined;
}

async function pickDefaultOrgId(app: any): Promise<string> {
  const envDefault = process.env.APGMS_DEFAULT_ORG_ID ?? "org_1";

  try {
    const db = app?.db;
    const row = await db?.org?.findFirst?.({
      select: { id: true },
      orderBy: { id: "asc" },
    });
    return (row?.id as string | undefined) ?? envDefault;
  } catch {
    return envDefault;
  }
}

const plugin: FastifyPluginAsync = async (app) => {
  app.get("/regulator/compliance/summary", async (req, reply) => {
    const env = process.env.NODE_ENV ?? "development";

    const headerOrgId = headerToString(req.headers["x-org-id"]);
    const userOrgId = (req as any).user?.orgId as string | undefined;

    let orgId = headerOrgId || userOrgId;

    // In non-production (tests/dev), fall back to deterministic org to avoid brittle e2e.
    if (!orgId && env !== "production") {
      orgId = await pickDefaultOrgId(app as any);
    }

    if (!orgId) {
      return reply.code(400).send({ error: "missing_org" });
    }

    const q = (req.query ?? {}) as any;
    const period = String(q.period ?? "2025-Q3");

    const result = await computeRegulatorComplianceSummary(app, { orgId, period });
    return reply.code(200).send(result);
  });
};

export default plugin;
