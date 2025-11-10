import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { authenticateRequest, type Role } from "../lib/auth.js";
import { extractTraceId } from "../utils/request-context.js";

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
    const user = (req as any).user;
    const orgId = user?.orgId as string | undefined;
    const actorId = user?.sub as string | undefined;
    const id = (req.params as any).id as string;
    const idx = DATA.findIndex((d) => d.id === id && d.orgId === orgId);
    const traceId = extractTraceId(req);

    if (idx >= 0) {
      const removed = DATA[idx];
      DATA.splice(idx, 1);
      app.metrics?.recordSecurityEvent?.("admin.data_override");
      if (orgId) {
        await app.riskEvents?.publishOverride({
          orgId,
          actorId,
          requestId: String(req.id),
          traceId,
          payload: {
            route: "/admin/data/:id",
            action: "delete",
            id,
            prior: removed,
          },
          severity: "medium",
        });
      }
      reply.send({ ok: true, deleted: true });
      return;
    }

    if (orgId) {
      app.metrics?.recordSecurityEvent?.("admin.data_missing_override");
      await app.riskEvents?.publishValidationFailure({
        orgId,
        actorId,
        requestId: String(req.id),
        traceId,
        payload: {
          route: "/admin/data/:id",
          reason: "record_not_found",
          id,
        },
        severity: "low",
      });
    }

    reply.send({ ok: true, deleted: false });
  });
}
