import type { FastifyInstance } from "fastify";
import { authGuard } from "../auth.js";
import { deleteUserWithRisk, type RiskDeleteStore } from "@apgms/shared/operations/risk/safe-delete";

export type AdminUsersDeps = {
  riskStore: RiskDeleteStore;
};

export function makeAdminUsersPlugin(deps: AdminUsersDeps) {
  return async function adminUsersPlugin(app: FastifyInstance): Promise<void> {
    app.delete<{ Params: { userId: string } }>(
      "/admin/users/:userId",
      { preHandler: [authGuard as any] },
      async (request, reply) => {
        const user = (request as any).user;
        if (!user || user.role !== "admin") {
          return reply.code(403).send({ error: { code: "forbidden", message: "Admin role required" } });
        }

        const outcome = await deleteUserWithRisk(deps.riskStore, request.params.userId);

        // Use 202 to make it explicit that the action may be anonymisation not deletion
        return reply.code(202).send(outcome);
      }
    );
  };
}
