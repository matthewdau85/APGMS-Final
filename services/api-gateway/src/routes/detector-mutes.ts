import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { badRequest, forbidden } from "@apgms/shared";
import {
  DETECTOR_MUTE_SCOPES,
  type DetectorMuteScope,
} from "@apgms/shared/alerts/muting.js";
import { createFeatureFlagClient } from "@apgms/feature-flags";

import { prisma } from "../db.js";
import { recordAuditLog } from "../lib/audit.js";

const featureFlags = createFeatureFlagClient();

const upsertSchema = z.object({
  scope: z.enum(DETECTOR_MUTE_SCOPES).optional(),
  streamId: z.string().min(1).optional(),
  period: z.string().min(1).optional(),
  reason: z.string().min(1).max(256).optional(),
  expiresAt: z.coerce.date().optional(),
});

const deleteSchema = z.object({
  scope: z.enum(DETECTOR_MUTE_SCOPES).optional(),
  streamId: z.string().min(1).optional(),
  period: z.string().min(1).optional(),
});

type Principal = {
  id: string;
  orgId: string;
};

const resolvePrincipal = (request: FastifyRequest): Principal => {
  const user = (request as FastifyRequest & { user?: Principal }).user;
  if (!user?.orgId || !user?.id) {
    throw forbidden("principal_missing", "Authenticated user context missing");
  }
  return { id: user.id, orgId: user.orgId };
};

const deriveScope = (
  input: { scope?: DetectorMuteScope; streamId?: string; period?: string },
): DetectorMuteScope => {
  if (input.scope) {
    return input.scope;
  }
  if (!input.streamId) {
    return "TENANT";
  }
  if (!input.period) {
    return "STREAM";
  }
  return "PERIOD";
};

const normaliseTargets = (
  scope: DetectorMuteScope,
  input: { streamId?: string; period?: string },
): { streamId: string | null; period: string | null } => {
  if (scope === "TENANT") {
    return { streamId: null, period: null };
  }
  const streamId = input.streamId;
  if (!streamId) {
    throw badRequest("detector_mute_invalid", "streamId is required for stream or period mutes");
  }
  if (scope === "STREAM") {
    return { streamId, period: null };
  }
  const period = input.period;
  if (!period) {
    throw badRequest("detector_mute_invalid", "period is required for period mutes");
  }
  return { streamId, period };
};

const invalidateCache = async (
  app: FastifyInstance,
  scope: DetectorMuteScope,
  orgId: string,
  streamId: string | null,
  period: string | null,
): Promise<void> => {
  const cache = app.detectorMuteCache;
  if (!cache) {
    return;
  }
  if (scope === "TENANT") {
    await cache.invalidateTenant(orgId);
  } else if (scope === "STREAM") {
    await cache.invalidateStream(orgId, streamId!);
  } else if (scope === "PERIOD") {
    await cache.invalidate({ tenantId: orgId, streamId: streamId!, period: period! });
  }
};

export async function registerDetectorMuteRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/detector/mutes",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const principal = resolvePrincipal(request);
      if (!featureFlags.isEnabled("detectorMuting", { orgId: principal.orgId })) {
        throw forbidden("detector_muting_disabled", "Detector muting is disabled");
      }

      const body = upsertSchema.parse(request.body);
      const scope = deriveScope(body);
      const { streamId, period } = normaliseTargets(scope, body);
      const reason = body.reason ?? null;
      const expiresAt = body.expiresAt ?? null;

      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.detectorMute.findFirst({
          where: {
            orgId: principal.orgId,
            scope,
            streamId,
            period,
          },
        });

        if (existing) {
          const updated = await tx.detectorMute.update({
            where: { id: existing.id },
            data: {
              reason,
              expiresAt,
              updatedBy: principal.id,
            },
          });
          await recordAuditLog({
            orgId: principal.orgId,
            actorId: principal.id,
            action: "detector.mute.updated",
            metadata: {
              muteId: updated.id,
              scope: updated.scope,
              streamId: updated.streamId,
              period: updated.period,
              reason: updated.reason,
              expiresAt: updated.expiresAt?.toISOString() ?? null,
            },
          });
          return updated;
        }

        const created = await tx.detectorMute.create({
          data: {
            orgId: principal.orgId,
            scope,
            streamId,
            period,
            reason,
            expiresAt,
            createdBy: principal.id,
            updatedBy: principal.id,
          },
        });

        await recordAuditLog({
          orgId: principal.orgId,
          actorId: principal.id,
          action: "detector.mute.created",
          metadata: {
            muteId: created.id,
            scope: created.scope,
            streamId: created.streamId,
            period: created.period,
            reason: created.reason,
            expiresAt: created.expiresAt?.toISOString() ?? null,
          },
        });

        return created;
      });

      await invalidateCache(app, scope, principal.orgId, streamId, period);

      reply.send({
        mute: {
          id: result.id,
          scope: result.scope,
          streamId: result.streamId,
          period: result.period,
          reason: result.reason,
          expiresAt: result.expiresAt?.toISOString() ?? null,
          createdAt: result.createdAt.toISOString(),
          updatedAt: result.updatedAt.toISOString(),
        },
      });
    },
  );

  app.delete(
    "/detector/mutes",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const principal = resolvePrincipal(request);
      if (!featureFlags.isEnabled("detectorMuting", { orgId: principal.orgId })) {
        throw forbidden("detector_muting_disabled", "Detector muting is disabled");
      }

      const query = deleteSchema.parse(request.query);
      const scope = deriveScope(query);
      const { streamId, period } = normaliseTargets(scope, query);

      const deleted = await prisma.$transaction(async (tx) => {
        const existing = await tx.detectorMute.findFirst({
          where: {
            orgId: principal.orgId,
            scope,
            streamId,
            period,
          },
        });
        if (!existing) {
          return false;
        }

        await tx.detectorMute.delete({ where: { id: existing.id } });
        await recordAuditLog({
          orgId: principal.orgId,
          actorId: principal.id,
          action: "detector.mute.deleted",
          metadata: {
            muteId: existing.id,
            scope: existing.scope,
            streamId: existing.streamId,
            period: existing.period,
            reason: existing.reason,
            expiresAt: existing.expiresAt?.toISOString() ?? null,
          },
        });
        return true;
      });

      if (deleted) {
        await invalidateCache(app, scope, principal.orgId, streamId, period);
      }

      reply.send({ removed: deleted });
    },
  );
}
