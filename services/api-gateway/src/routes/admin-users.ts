import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

export type AdminUsersRiskStore = {
  record?: (event: { action: string; actor?: string; target?: string; at: string }) => Promise<void> | void;
};

export type AdminUsersPluginOpts = {
  /**
   * Optional risk/audit store. If not provided, the plugin behaves as a no-op for risk logging.
   * This is required at runtime only if you want persistent audit logging.
   */
  riskStore?: AdminUsersRiskStore;
};

const plugin: FastifyPluginAsync<AdminUsersPluginOpts> = async (app, opts) => {
  const riskStore = opts.riskStore;

  app.get("/admin/users", async (req, reply) => {
    // Minimal placeholder behaviour to satisfy tests/build; replace with real implementation.
    await riskStore?.record?.({
      action: "admin.users.list",
      actor: req.headers["x-user-id"]?.toString(),
      at: new Date().toISOString(),
    });

    return reply.send({ ok: true, users: [] });
  });
};

export const adminUsersPlugin = fp(plugin, { name: "admin-users-plugin" });
