import type { FastifyPluginAsync } from "fastify";

// Keep this store type intentionally loose for prototype compatibility.
// We'll tighten it later once the shared RiskDeleteStore is stable.
export type AdminUsersRiskStore = {
  recordRiskEvent?: (event: any) => Promise<void> | void;
};

export type AdminUsersPluginOpts = {
  riskStore: AdminUsersRiskStore;
};

/**
 * Admin-only prototype endpoint:
 *   DELETE /admin/users/:userId
 *
 * This is registered under a prototype-admin scope in app.ts.
 */
export const adminUsersPlugin: FastifyPluginAsync<AdminUsersPluginOpts> = async (app, opts) => {
  app.delete<{ Params: { userId: string } }>("/users/:userId", async (request, reply) => {
    const orgId = String(request.headers["x-org-id"] ?? "");
    const actor = String(request.headers["x-actor"] ?? "");

    if (!orgId) {
      return reply.code(400).send({ code: "missing_org" });
    }
    if (!actor) {
      return reply.code(400).send({ code: "missing_actor" });
    }

    await opts.riskStore?.recordRiskEvent?.({
      orgId,
      action: "USER_DELETE_REQUESTED",
      actor,
      entityId: request.params.userId,
      ts: new Date().toISOString(),
    });

    // Prototype: accept-and-enqueue semantics
    return reply.code(202).send({ ok: true });
  });
};

export default adminUsersPlugin;
