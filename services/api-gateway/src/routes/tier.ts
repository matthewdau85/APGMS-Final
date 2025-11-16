import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../db.js";
import { TierManager, SubscriptionTier } from "../services/tier-manager.js";
import { parseWithSchema } from "../lib/validation.js";

const tierManager = new TierManager(prisma);

const tierUpdateSchema = z.object({
  tier: z.nativeEnum(SubscriptionTier),
});

function requireOrgId(request: FastifyRequest, reply: FastifyReply): string | null {
  const orgId = (request.user as any)?.orgId;
  if (!orgId) {
    reply.code(401).send({ error: "org_missing" });
    return null;
  }
  return orgId;
}

export async function registerTierRoutes(app: FastifyInstance) {
  app.get("/tier", async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) {
      return;
    }
    const tier = await tierManager.getTier(orgId);
    reply.send({ tier });
  });

  app.post("/tier", async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) {
      return;
    }
    const payload = parseWithSchema(tierUpdateSchema, request.body);
    const tier = await tierManager.setTier(orgId, payload.tier);
    reply.send({ tier });
  });
}
