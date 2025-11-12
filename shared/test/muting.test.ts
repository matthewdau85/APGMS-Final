import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DETECTOR_MUTE_REASONS,
  DETECTOR_MUTE_SCOPES,
  embedMuteInMetric,
  evaluateMute,
  type DetectorMuteRecord,
} from "../src/alerts/muting.js";

test("detector muting reasons constant ordering", () => {
  assert.deepEqual(DETECTOR_MUTE_REASONS, [
    "NONE",
    "TENANT_MUTED",
    "STREAM_MUTED",
    "PERIOD_MUTED",
    "EXPIRED",
  ]);
  assert.deepEqual(DETECTOR_MUTE_SCOPES, ["TENANT", "STREAM", "PERIOD"]);
});

test("evaluates tenant level mute", () => {
  const now = new Date("2025-01-01T00:00:00Z");
  const records: DetectorMuteRecord[] = [
    {
      id: "mute-1",
      orgId: "tenant-1",
      scope: "TENANT",
    },
  ];

  const evaluation = evaluateMute(records, {
    tenantId: "tenant-1",
    streamId: "stream-a",
    period: "2025-01",
  }, now);

  assert.equal(evaluation.muted, true);
  assert.equal(evaluation.reason, "TENANT_MUTED");
  assert.equal(evaluation.source?.id, "mute-1");
});

test("prefers specific stream mute over tenant", () => {
  const now = new Date("2025-01-01T00:00:00Z");
  const records: DetectorMuteRecord[] = [
    {
      id: "tenant-mute",
      orgId: "tenant-1",
      scope: "TENANT",
    },
    {
      id: "stream-mute",
      orgId: "tenant-1",
      scope: "STREAM",
      streamId: "stream-a",
    },
  ];

  const evaluation = evaluateMute(records, {
    tenantId: "tenant-1",
    streamId: "stream-a",
    period: "2025-01",
  }, now);

  assert.equal(evaluation.muted, true);
  assert.equal(evaluation.reason, "STREAM_MUTED");
  assert.equal(evaluation.source?.id, "stream-mute");
});

test("prefers period mute over stream", () => {
  const now = new Date("2025-01-01T00:00:00Z");
  const records: DetectorMuteRecord[] = [
    {
      id: "stream-mute",
      orgId: "tenant-1",
      scope: "STREAM",
      streamId: "stream-a",
    },
    {
      id: "period-mute",
      orgId: "tenant-1",
      scope: "PERIOD",
      streamId: "stream-a",
      period: "2025-01",
    },
  ];

  const evaluation = evaluateMute(records, {
    tenantId: "tenant-1",
    streamId: "stream-a",
    period: "2025-01",
  }, now);

  assert.equal(evaluation.muted, true);
  assert.equal(evaluation.reason, "PERIOD_MUTED");
  assert.equal(evaluation.source?.id, "period-mute");
});

test("falls back to non-expired mute when higher priority mute expired", () => {
  const now = new Date("2025-02-01T00:00:00Z");
  const records: DetectorMuteRecord[] = [
    {
      id: "expired-period",
      orgId: "tenant-1",
      scope: "PERIOD",
      streamId: "stream-a",
      period: "2025-01",
      expiresAt: new Date("2025-01-15T00:00:00Z"),
    },
    {
      id: "active-stream",
      orgId: "tenant-1",
      scope: "STREAM",
      streamId: "stream-a",
    },
  ];

  const evaluation = evaluateMute(
    records,
    {
      tenantId: "tenant-1",
      streamId: "stream-a",
      period: "2025-02",
    },
    now,
  );

  assert.equal(evaluation.muted, true);
  assert.equal(evaluation.reason, "STREAM_MUTED");
  assert.equal(evaluation.source?.id, "active-stream");
});

test("marks expired mute as not muted", () => {
  const now = new Date("2025-02-01T00:00:00Z");
  const records: DetectorMuteRecord[] = [
    {
      id: "expired",
      orgId: "tenant-1",
      scope: "TENANT",
      expiresAt: new Date("2025-01-15T00:00:00Z"),
    },
  ];

  const evaluation = evaluateMute(records, {
    tenantId: "tenant-1",
    streamId: "stream-a",
    period: "2025-02",
  }, now);

  assert.equal(evaluation.muted, false);
  assert.equal(evaluation.reason, "EXPIRED");
  assert.equal(evaluation.source?.id, "expired");
});

test("embedMuteInMetric adds mute payload", () => {
  const metric = {
    tenantId: "tenant-1",
    streamId: "stream-a",
    period: "2025-01",
    count: 10,
  };
  const evaluation = {
    muted: true,
    reason: "STREAM_MUTED" as const,
    source: {
      id: "stream-mute",
      orgId: "tenant-1",
      scope: "STREAM" as const,
      streamId: "stream-a",
      period: null,
      expiresAt: new Date("2025-03-01T00:00:00Z"),
    },
  } satisfies ReturnType<typeof evaluateMute>;

  const enriched = embedMuteInMetric(metric, evaluation);
  assert.equal(enriched.mute.muted, true);
  assert.equal(enriched.mute.reason, "STREAM_MUTED");
  assert.equal(enriched.mute.muteId, "stream-mute");
  assert.equal(enriched.mute.scope, "STREAM");
  assert.equal(enriched.mute.expiresAt, "2025-03-01T00:00:00.000Z");
  assert.equal(enriched.count, 10);
});
