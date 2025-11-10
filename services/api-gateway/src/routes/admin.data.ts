import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticateRequest, type Principal, type Role } from "../lib/auth.js";
import { includePrototypeEnv } from "../lib/prototype-env.js";

// minimal in-memory placeholder dataset
const DATA: { id: string; value: string; orgId: string }[] = [];

export async function registerAdminDataRoutes(app: FastifyInstance) {
  const gate = (roles: readonly Role[] = []) =>
    async (req: FastifyRequest, reply: FastifyReply) => {
      const principal = await authenticateRequest(app, req, reply, roles);
      if (!principal) {
        return;
      }
      (req as FastifyRequest & { user?: Principal }).user = principal;
    };

  app.get("/admin/data", { preHandler: gate([]) }, async (req, reply) => {
    const principal = (req as FastifyRequest & { user?: Principal }).user;
    const orgId = principal?.orgId;
    const payload = includePrototypeEnv(
      reply,
      { items: DATA.filter((d) => d.orgId === orgId) },
      principal?.roles,
    );
    reply.send(payload);
  });

  app.delete("/admin/data/:id", { preHandler: gate(["admin"]) }, async (req, reply) => {
    const principal = (req as FastifyRequest & { user?: Principal }).user;
    const orgId = principal?.orgId;
    const id = (req.params as any).id as string;
    const idx = DATA.findIndex(d => d.id === id && d.orgId === orgId);
    if (idx >= 0) {
      DATA.splice(idx, 1);
    }
    const payload = includePrototypeEnv(reply, { ok: true }, principal?.roles);
    reply.send(payload);
  });
}
