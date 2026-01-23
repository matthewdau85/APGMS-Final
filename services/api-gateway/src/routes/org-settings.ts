// services/api-gateway/src/routes/org-settings.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { readState, updateState } from "../state/dev-state.js";

function badRequest(message: string, details?: Record<string, unknown>) {
  return {
    statusCode: 400,
    body: {
      error: "bad_request",
      message,
      details: details || {},
    },
  };
}

export default async function orgSettingsRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  app.get("/org/settings", async () => {
    const s = readState();
    return {
      addons: s.orgSettings.addons,
    };
  });

  app.patch("/org/settings", async (req, reply) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const addonsRaw = body.addons;

    if (addonsRaw !== undefined && (typeof addonsRaw !== "object" || addonsRaw === null)) {
      const r = badRequest("addons must be an object", { field: "addons" });
      return reply.code(r.statusCode).send(r.body);
    }

    const next = updateState((s) => {
      if (addonsRaw && typeof addonsRaw === "object") {
        const addons = addonsRaw as Record<string, unknown>;
        if (addons.clearComplianceTraining !== undefined) {
          s.orgSettings.addons.clearComplianceTraining = Boolean(
            addons.clearComplianceTraining
          );
        }
      }
    });

    return reply.send({
      ok: true,
      addons: next.orgSettings.addons,
    });
  });
}
