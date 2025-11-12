import type { Prisma } from "@prisma/client";

import { prisma } from "@apgms/shared/db.js";
import { forbidden } from "@apgms/shared/errors.js";
import {
  type DetectorMuteScope,
  DETECTOR_MUTE_SCOPES,
} from "@apgms/shared/alerts/muting.js";
import {
  createFeatureFlagClient,
  type FeatureFlagClient,
} from "@apgms/feature-flags";

export type UpsertMuteInput = {
  orgId: string;
  actorId: string;
  streamId?: string | null;
  period?: string | null;
  scope?: DetectorMuteScope;
  reason?: string | null;
  expiresAt?: Date | null;
};

export type DeleteMuteInput = {
  orgId: string;
  actorId: string;
  streamId?: string | null;
  period?: string | null;
  scope?: DetectorMuteScope;
};

type Dependencies = {
  prisma: typeof prisma;
  flags: FeatureFlagClient;
  now: () => Date;
};

const defaultDependencies: Dependencies = {
  prisma,
  flags: createFeatureFlagClient(),
  now: () => new Date(),
};

const normalizeScope = (
  input: UpsertMuteInput | DeleteMuteInput,
): DetectorMuteScope => {
  if (input.scope) {
    if (!DETECTOR_MUTE_SCOPES.includes(input.scope)) {
      throw new Error(`Unsupported mute scope ${input.scope}`);
    }
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

const resolveTarget = (
  input: UpsertMuteInput | DeleteMuteInput,
): { scope: DetectorMuteScope; streamId: string | null; period: string | null } => {
  const scope = normalizeScope(input);
  const streamId = scope === "TENANT" ? null : input.streamId ?? null;
  const period = scope === "PERIOD" ? input.period ?? null : null;
  return { scope, streamId, period };
};

const ensureFeatureEnabled = (
  flags: FeatureFlagClient,
  orgId: string,
): void => {
  if (!flags.isEnabled("detectorMuting", { orgId })) {
    throw forbidden(
      "detector_muting_disabled",
      "Detector muting is disabled for this organisation",
    );
  }
};

const buildMetadata = (
  record: {
    id: string;
    scope: DetectorMuteScope;
    streamId: string | null;
    period: string | null;
    expiresAt: Date | null;
    reason: string | null;
  },
  action: "created" | "updated" | "deleted",
) => ({
  muteId: record.id,
  scope: record.scope,
  streamId: record.streamId,
  period: record.period,
  expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
  reason: record.reason,
  action,
});

export async function upsertDetectorMute(
  input: UpsertMuteInput,
  dependencies: Dependencies = defaultDependencies,
) {
  ensureFeatureEnabled(dependencies.flags, input.orgId);

  const { scope, streamId, period } = resolveTarget(input);
  const expiresAt = input.expiresAt ?? null;
  const reason = input.reason ?? null;
  const actorId = input.actorId;

  const record = await dependencies.prisma.$transaction(async (tx) => {
    const existing = await tx.detectorMute.findFirst({
      where: {
        orgId: input.orgId,
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
          updatedBy: actorId,
        },
      });
      await tx.auditLog.create({
        data: {
          orgId: input.orgId,
          actorId,
          action: "detector.mute.updated",
          metadata: buildMetadata(updated, "updated") as Prisma.JsonValue,
        },
      });
      return updated;
    }

    const created = await tx.detectorMute.create({
      data: {
        orgId: input.orgId,
        scope,
        streamId,
        period,
        reason,
        expiresAt,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });

    await tx.auditLog.create({
      data: {
        orgId: input.orgId,
        actorId,
        action: "detector.mute.created",
        metadata: buildMetadata(created, "created") as Prisma.JsonValue,
      },
    });

    return created;
  });

  return record;
}

export async function deleteDetectorMute(
  input: DeleteMuteInput,
  dependencies: Dependencies = defaultDependencies,
): Promise<boolean> {
  ensureFeatureEnabled(dependencies.flags, input.orgId);

  const { scope, streamId, period } = resolveTarget(input);
  const actorId = input.actorId;

  return dependencies.prisma.$transaction(async (tx) => {
    const existing = await tx.detectorMute.findFirst({
      where: {
        orgId: input.orgId,
        scope,
        streamId,
        period,
      },
    });

    if (!existing) {
      return false;
    }

    await tx.detectorMute.delete({ where: { id: existing.id } });
    await tx.auditLog.create({
      data: {
        orgId: input.orgId,
        actorId,
        action: "detector.mute.deleted",
        metadata: buildMetadata(existing, "deleted") as Prisma.JsonValue,
      },
    });

    return true;
  });
}
