import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { updateTenantMetadata, updateTenantSettings } from "@apgms/shared/tenant-config";
import { resolveAdvisoryContext } from "../lib/benford/advisory.js";
import { parseWithSchema } from "../lib/validation.js";

const UpdateBenfordSettingsSchema = z.object({
  showAtoContext: z.boolean().optional(),
  region: z.string().optional(),
  locale: z.string().optional(),
});

type RequestUser = {
  orgId: string;
  role?: string;
};

function ensureUser(request: FastifyRequest, reply: FastifyReply): RequestUser | null {
  const user = (request as any).user as RequestUser | undefined;
  if (!user?.orgId) {
    reply.code(401).send({
      error: { code: "unauthorized", message: "Authentication required" },
    });
    return null;
  }
  return user;
}

export async function registerTenantSettingsRoutes(app: FastifyInstance) {
  app.get("/tenant-settings/benford", async (request, reply) => {
    const user = ensureUser(request, reply);
    if (!user) return;

    const context = resolveAdvisoryContext(user.orgId);
    reply.send({
      tenantId: context.tenantId,
      region: context.region,
      locale: context.locale,
      showAtoContext: context.showAtoContext,
    });
  });

  app.patch("/tenant-settings/benford", async (request, reply) => {
    const user = ensureUser(request, reply);
    if (!user) return;

    const payload = parseWithSchema(UpdateBenfordSettingsSchema, request.body ?? {});

    if (payload.region || payload.locale) {
      updateTenantMetadata(user.orgId, {
        region: payload.region,
        locale: payload.locale,
      });
    }

    if (payload.showAtoContext !== undefined) {
      updateTenantSettings(user.orgId, { showAtoContext: payload.showAtoContext });
    }

    const context = resolveAdvisoryContext(user.orgId);

    reply.send({
      tenantId: context.tenantId,
      region: context.region,
      locale: context.locale,
      showAtoContext: context.showAtoContext,
    });
  });
}

export default registerTenantSettingsRoutes;
