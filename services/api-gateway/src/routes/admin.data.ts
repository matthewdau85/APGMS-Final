import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticateRequest, type Role } from "../lib/auth.js";
import { publishComplianceEvent } from "../lib/compliance-events.js";

// minimal in-memory placeholder dataset
const DATA: { id: string; value: string; orgId: string }[] = [];

export async function registerAdminDataRoutes(app: FastifyInstance) {
  const gate = (roles: readonly Role[] = []) =>
    async (req: FastifyRequest, reply: FastifyReply) =>
      authenticateRequest(app, req, reply, roles);

  app.get("/admin/data", { preHandler: gate([]) }, async (req, reply) => {
    const orgId = (req as any).user?.orgId as string | undefined;
    reply.send({ items: DATA.filter(d => d.orgId === orgId) });
  });

  app.delete("/admin/data/:id", { preHandler: gate(["admin"]) }, async (req, reply) => {
    const user = (req as any).user!;
    const orgId = user.orgId as string | undefined;
    const id = (req.params as any).id as string;
    const idx = DATA.findIndex(d => d.id === id && d.orgId === orgId);
    const existed = idx >= 0;
    if (existed) {
      DATA.splice(idx, 1);
    }

    if (orgId) {
      await publishComplianceEvent(app, {
        kind: "OVERRIDE",
        orgId,
        category: "admin.dataset.deletion",
        severity: existed ? "LOW" : "MEDIUM",
        description: existed
          ? "Dataset entry manually deleted by administrator"
          : "Administrator attempted to delete a non-existent dataset entry",
        metadata: { itemId: id, existed },
        actor: { type: "user", id: user.sub, role: user.role },
        request: req,
        source: "api-gateway.admin-data",
      });

      if (!existed) {
        await publishComplianceEvent(app, {
          kind: "DISCREPANCY",
          orgId,
          category: "admin.dataset.desync",
          severity: "MEDIUM",
          description: "Requested deletion could not find matching dataset entry",
          metadata: { itemId: id },
          actor: { type: "user", id: user.sub, role: user.role },
          request: req,
          source: "api-gateway.admin-data",
        });
      }
    }

    reply.send({ ok: true });
  });
}
