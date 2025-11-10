import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import { mkdtemp, readFile, readdir, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  TransactionalTopics,
  TRANSACTIONAL_EVENT_SCHEMA_VERSION,
} from "../../shared/src/messaging/transactional-events.js";

import {
  configureStorage,
  getStorageRoot,
  persistTransactionalEvent,
} from "../src/storage/data-lake.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

let tempRoot;

beforeEach(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), "apgms-data-lake-"));
  configureStorage({ root: tempRoot, defaultRetentionDays: 30 });
});

afterEach(async () => {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

function buildReconEvent(overrides = {}) {
  const summary =
    overrides.summary ?? {
      generatedAt: new Date().toISOString(),
      totals: { paygw: 1000, gst: 500 },
      movementsLast24h: [
        {
          accountId: "acct_paygw",
          type: "PAYGW",
          balance: 800,
          inflow24h: 200,
          transferCount24h: 4,
        },
      ],
    };

  const base = {
    eventId: overrides.eventId ?? randomUUID(),
    occurredAt: overrides.occurredAt ?? new Date().toISOString(),
    schemaVersion:
      overrides.schemaVersion ?? TRANSACTIONAL_EVENT_SCHEMA_VERSION,
    source: overrides.source ?? "test-suite",
    orgId: overrides.orgId ?? "org_test",
    artifactId: overrides.artifactId ?? "artifact_test",
    summary,
  };

  const sha256 =
    overrides.sha256 ??
    createHash("sha256").update(JSON.stringify(base.summary)).digest("hex");

  return { ...base, sha256, ...overrides };
}

test("persistTransactionalEvent writes payloads with immutable identifiers", async () => {
  const event = buildReconEvent();

  const storedPath = await persistTransactionalEvent(
    TransactionalTopics.reconciliation.designatedGenerated,
    event,
  );

  assert.ok(storedPath.startsWith(getStorageRoot()));
  const contents = JSON.parse(await readFile(storedPath, "utf-8"));
  assert.equal(contents.eventId, event.eventId);
  assert.equal(contents.occurredAt, event.occurredAt);
  assert.equal(contents.summary.totals.paygw, 1000);
});

test("quality checks short-circuit persistence", async () => {
  const event = buildReconEvent({
    summary: {
      generatedAt: new Date().toISOString(),
      totals: { paygw: 10, gst: 5 },
      movementsLast24h: [],
    },
  });

  await assert.rejects(
    () =>
      persistTransactionalEvent(
        TransactionalTopics.reconciliation.designatedGenerated,
        event,
        {
          qualityChecks: [
            {
              name: "fail_always",
              validate: () => {
                throw new Error("boom");
              },
            },
          ],
        },
      ),
    /Quality check 'fail_always' failed: boom/,
  );
});

test("retention removes files older than the configured window", async () => {
  const eventOne = buildReconEvent({
    eventId: "11111111-1111-4111-8111-111111111111",
    occurredAt: "2024-10-01T00:00:00.000Z",
  });
  const firstPath = await persistTransactionalEvent(
    TransactionalTopics.reconciliation.designatedGenerated,
    eventOne,
  );

  const oldDate = new Date(Date.now() - 10 * MS_PER_DAY);
  await utimes(firstPath, oldDate, oldDate);

  const eventTwo = buildReconEvent({
    eventId: "22222222-2222-4222-8222-222222222222",
    occurredAt: new Date().toISOString(),
  });
  await persistTransactionalEvent(
    TransactionalTopics.reconciliation.designatedGenerated,
    eventTwo,
    { retentionDays: 1 },
  );

  const topicDir = join(
    getStorageRoot(),
    ...TransactionalTopics.reconciliation.designatedGenerated.split("."),
  );
  const files = await readdir(topicDir);
  assert.equal(files.length, 1);
  assert.ok(files[0].startsWith("22222222-2222-4222-8222-222222222222"));
});
