import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticateRequest, type Role } from "@apgms/auth";

// minimal in-memory placeholder dataset
const DATA: { id: string; value: string; orgId: string }[] = [];

export async function registerAdminDataRoutes(app: FastifyInstance) {
  const gate = (roles: readonly Role[] = []) =>
    async (req: FastifyRequest, reply: FastifyReply) => {
      const principal = await authenticateRequest(app, req, reply, roles);
      if (!principal) {
        return;
      }

      (req as any).user = principal;
    };

  app.get("/admin/data", { preHandler: gate([]) }, async (req, reply) => {
    const orgId = (req as any).user?.orgId as string | undefined;
    reply.send({ items: DATA.filter(d => d.orgId === orgId) });
  });

  app.delete("/admin/data/:id", { preHandler: gate(["admin"]) }, async (req, reply) => {
    const orgId = (req as any).user?.orgId as string | undefined;
    const id = (req.params as any).id as string;
    const idx = DATA.findIndex(d => d.id === id && d.orgId === orgId);
    if (idx >= 0) {
      DATA.splice(idx, 1);
    }
    reply.send({ ok: true });
  });
}
