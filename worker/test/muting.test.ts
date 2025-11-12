import assert from "node:assert/strict";
import { test } from "node:test";

import type { FeatureFlagClient } from "@apgms/feature-flags";

import {
  deleteDetectorMute,
  upsertDetectorMute,
  type UpsertMuteInput,
} from "../src/muting/service.js";

type DetectorMuteState = {
  id: string;
  orgId: string;
  scope: "TENANT" | "STREAM" | "PERIOD";
  streamId: string | null;
  period: string | null;
  reason: string | null;
  expiresAt: Date | null;
  createdBy: string;
  updatedBy: string | null;
};

type AuditLogEntry = {
  action: string;
  metadata: Record<string, unknown> | null;
};

type InMemoryPrisma = {
  detectorMute: {
    findFirst: (args: any) => Promise<DetectorMuteState | null>;
    create: (args: any) => Promise<DetectorMuteState>;
    update: (args: any) => Promise<DetectorMuteState>;
    delete: (args: any) => Promise<void>;
  };
  auditLog: {
    create: (args: any) => Promise<void>;
  };
};

const createInMemoryDependencies = (
  initial?: { mutes?: DetectorMuteState[]; audit?: AuditLogEntry[] },
): {
  prisma: InMemoryPrisma;
  flags: FeatureFlagClient;
  state: { mutes: DetectorMuteState[]; audit: AuditLogEntry[] };
} => {
  const state = {
    mutes: initial?.mutes ? [...initial.mutes] : [],
    audit: initial?.audit ? [...initial.audit] : [],
  };

  const prisma: InMemoryPrisma = {
    detectorMute: {
      async findFirst({ where }: any) {
        return (
          state.mutes.find((mute) =>
            mute.orgId === where.orgId &&
            mute.scope === where.scope &&
            mute.streamId === (where.streamId ?? null) &&
            mute.period === (where.period ?? null),
          ) ?? null
        );
      },
      async create({ data }: any) {
        const record: DetectorMuteState = {
          id: `mute-${state.mutes.length + 1}`,
          orgId: data.orgId,
          scope: data.scope,
          streamId: data.streamId ?? null,
          period: data.period ?? null,
          reason: data.reason ?? null,
          expiresAt: data.expiresAt ?? null,
          createdBy: data.createdBy,
          updatedBy: data.updatedBy ?? null,
        };
        state.mutes.push(record);
        return { ...record };
      },
      async update({ where, data }: any) {
        const record = state.mutes.find((mute) => mute.id === where.id);
        if (!record) throw new Error("mute not found");
        if (Object.prototype.hasOwnProperty.call(data, "reason")) {
          record.reason = data.reason ?? null;
        }
        if (Object.prototype.hasOwnProperty.call(data, "expiresAt")) {
          record.expiresAt = data.expiresAt ?? null;
        }
        record.updatedBy = data.updatedBy ?? record.updatedBy;
        return { ...record };
      },
      async delete({ where }: any) {
        const idx = state.mutes.findIndex((mute) => mute.id === where.id);
        if (idx >= 0) {
          state.mutes.splice(idx, 1);
        }
      },
    },
    auditLog: {
      async create({ data }: any) {
        state.audit.push({
          action: data.action,
          metadata: (data.metadata ?? null) as Record<string, unknown> | null,
        });
      },
    },
  };

  const flags: FeatureFlagClient = {
    isEnabled(flag, context) {
      void context;
      return flag === "detectorMuting";
    },
  };

  return { prisma: prisma as unknown as InMemoryPrisma, flags, state };
};

test("upsertDetectorMute creates new record and logs audit", async () => {
  const deps = createInMemoryDependencies();
  const input: UpsertMuteInput = {
    orgId: "tenant-1",
    actorId: "user-1",
    streamId: "stream-a",
    period: "2025-01",
    reason: "investigation",
  };

  const record = await upsertDetectorMute(input, {
    prisma: deps.prisma as any,
    flags: deps.flags,
    now: () => new Date("2025-01-01T00:00:00Z"),
  });

  assert.equal(record.orgId, "tenant-1");
  assert.equal(record.scope, "PERIOD");
  assert.equal(deps.state.mutes.length, 1);
  assert.equal(deps.state.audit.at(-1)?.action, "detector.mute.created");
});

test("upsertDetectorMute updates existing record", async () => {
  const deps = createInMemoryDependencies({
    mutes: [
      {
        id: "mute-1",
        orgId: "tenant-1",
        scope: "STREAM",
        streamId: "stream-a",
        period: null,
        reason: null,
        expiresAt: null,
        createdBy: "user-1",
        updatedBy: "user-1",
      },
    ],
  });

  const record = await upsertDetectorMute(
    {
      orgId: "tenant-1",
      actorId: "user-2",
      streamId: "stream-a",
      reason: "temporary",
    },
    {
      prisma: deps.prisma as any,
      flags: deps.flags,
      now: () => new Date(),
    },
  );

  assert.equal(record.reason, "temporary");
  assert.equal(deps.state.audit.at(-1)?.action, "detector.mute.updated");
});

test("deleteDetectorMute removes record and logs audit", async () => {
  const deps = createInMemoryDependencies({
    mutes: [
      {
        id: "mute-1",
        orgId: "tenant-1",
        scope: "TENANT",
        streamId: null,
        period: null,
        reason: null,
        expiresAt: null,
        createdBy: "user-1",
        updatedBy: "user-1",
      },
    ],
  });

  const removed = await deleteDetectorMute(
    {
      orgId: "tenant-1",
      actorId: "user-3",
    },
    {
      prisma: deps.prisma as any,
      flags: deps.flags,
      now: () => new Date(),
    },
  );

  assert.equal(removed, true);
  assert.equal(deps.state.mutes.length, 0);
  assert.equal(deps.state.audit.at(-1)?.action, "detector.mute.deleted");
});

test("feature flag disabled rejects operations", async () => {
  const deps = createInMemoryDependencies();
  const input: UpsertMuteInput = {
    orgId: "tenant-1",
    actorId: "user-1",
  };

  await assert.rejects(
    upsertDetectorMute(input, {
      prisma: deps.prisma as any,
      flags: { isEnabled: () => false },
      now: () => new Date(),
    }),
    /detector_muting_disabled/,
  );
});
