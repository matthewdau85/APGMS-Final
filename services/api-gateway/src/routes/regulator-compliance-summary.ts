import type { FastifyPluginAsync } from "fastify";
import { authGuard } from "../auth.js";
import { Role } from "../plugins/auth.js";
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
  app.get(
    "/regulator/compliance/summary",
    { preHandler: authGuard as any },
    async (req, reply) => {
      const user = (req as any).user as { orgId?: string; role?: string } | undefined;
      if (!user) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      if (user.role !== Role.regulator) {
        return reply.code(403).send({ error: "forbidden" });
      }

      const headerOrgId = headerToString(req.headers["x-org-id"]);
      const userOrgId = typeof user.orgId === "string" ? user.orgId : undefined;

      if (headerOrgId && userOrgId && headerOrgId !== userOrgId) {
        return reply.code(403).send({ error: "forbidden_org" });
      }

      let orgId = headerOrgId || userOrgId;
      if (!orgId) {
        const envName = String(process.env.NODE_ENV ?? "development").toLowerCase();
        if (envName !== "production") {
          orgId = await pickDefaultOrgId(app);
        } else {
          return reply.code(400).send({ error: "missing_org" });
        }
      }

      const q = (req.query ?? {}) as any;
      const period = String(q.period ?? "2025-Q3");

      const result = await computeRegulatorComplianceSummary(app, { orgId, period });
      return reply.code(200).send(result);
    }
  );
};

export default plugin;
