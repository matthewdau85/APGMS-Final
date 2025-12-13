import type { FastifyInstance } from "fastify";
import { getServiceMode, setServiceMode, type ServiceMode } from "../service-mode.js";

function requireAdminToken() {
  return async (req: any, reply: any) => {
    const expected = process.env.ADMIN_SERVICE_MODE_TOKEN;

    // Fail closed if not configured (prevents accidental exposure)
    if (!expected) {
      return reply.code(503).send({
        error: "ADMIN_TOKEN_NOT_CONFIGURED",
        message: "ADMIN_SERVICE_MODE_TOKEN is not set.",
      });
    }

    const actual = req.headers["x-admin-token"];
    if (typeof actual !== "string" || actual !== expected) {
      return reply.code(403).send({
        error: "FORBIDDEN",
        message: "Invalid or missing x-admin-token.",
      });
    }
  };
}

export async function adminServiceModePlugin(app: FastifyInstance): Promise<void> {
  const adminGuard = requireAdminToken();

  app.get("/service-mode", { preHandler: adminGuard }, async () => {
    return getServiceMode();
  });

  app.put<{ Body: { mode: ServiceMode; reason?: string } }>(
    "/service-mode",
    {
      preHandler: adminGuard,
      schema: {
        body: {
          type: "object",
          required: ["mode"],
          additionalProperties: false,
          properties: {
            mode: { type: "string", enum: ["normal", "read-only", "suspended"] },
            reason: { type: "string" },
          },
        },
      },
    },
    async (req) => {
      return setServiceMode(req.body.mode, { by: "admin-endpoint", reason: req.body.reason });
    }
  );
}
