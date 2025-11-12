import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";

import { InMemoryEventBus } from "@apgms/shared/messaging/in-memory-bus.js";
import {
  DETECTOR_NIGHTLY_SUBJECT,
  LEDGER_COMPACTION_SUBJECT,
} from "@apgms/events";

import {
  DetectorMuteCache,
  registerDetectorCacheInvalidation,
} from "../src/cache/detector-mute-cache.js";

const sampleEntry = {
  muted: true,
  reason: "STREAM_MUTED" as const,
  muteId: "mute-1",
  scope: "STREAM" as const,
  expiresAt: "2025-03-01T00:00:00Z",
  evaluatedAt: "2025-01-01T00:00:00Z",
};

const createEnvelope = <T>(
  subject: string,
  orgId: string,
  payload: T,
) => ({
  id: `${subject}-${Math.random().toString(16).slice(2, 10)}`,
  orgId,
  eventType: subject,
  key: subject,
  ts: new Date().toISOString(),
  schemaVersion: "1",
  source: "test",
  dedupeId: `${subject}-${Date.now()}`,
  payload,
});

test("detector mute cache invalidates entries by scope", async () => {
  const cache = new DetectorMuteCache();

  await cache.set(
    { tenantId: "tenant-1", streamId: "stream-a", period: "2025-01" },
    sampleEntry,
  );
  await cache.set(
    { tenantId: "tenant-1", streamId: "stream-b", period: "2025-01" },
    sampleEntry,
  );

  assert.ok(
    await cache.get({ tenantId: "tenant-1", streamId: "stream-a", period: "2025-01" }),
  );

  await cache.invalidateStream("tenant-1", "stream-a");
  assert.equal(
    await cache.get({ tenantId: "tenant-1", streamId: "stream-a", period: "2025-01" }),
    null,
  );

  await cache.invalidateTenant("tenant-1");
  assert.equal(
    await cache.get({ tenantId: "tenant-1", streamId: "stream-b", period: "2025-01" }),
    null,
  );
});

test("cache invalidation reacts to bus events", async () => {
  const cache = new DetectorMuteCache();
  const bus = new InMemoryEventBus();

  await registerDetectorCacheInvalidation({ cache, bus, logger: undefined });

  await cache.set(
    { tenantId: "tenant-2", streamId: "stream-a", period: "2025-02" },
    sampleEntry,
  );

  await bus.publish(
    DETECTOR_NIGHTLY_SUBJECT,
    createEnvelope(DETECTOR_NIGHTLY_SUBJECT, "tenant-2", {
      tenantId: "tenant-2",
      period: "2025-02",
      triggeredAt: new Date().toISOString(),
    }),
  );

  // Allow async subscription loop to process
  await delay(0);

  assert.equal(
    await cache.get({ tenantId: "tenant-2", streamId: "stream-a", period: "2025-02" }),
    null,
  );

  await cache.set(
    { tenantId: "tenant-3", streamId: "stream-z", period: "2025-02" },
    sampleEntry,
  );

  await bus.publish(
    LEDGER_COMPACTION_SUBJECT,
    createEnvelope(LEDGER_COMPACTION_SUBJECT, "tenant-3", {
      tenantId: "tenant-3",
      streamId: "stream-z",
      period: "2025-02",
      triggeredAt: new Date().toISOString(),
    }),
  );

  await delay(0);

  assert.equal(
    await cache.get({ tenantId: "tenant-3", streamId: "stream-z", period: "2025-02" }),
    null,
  );
});
