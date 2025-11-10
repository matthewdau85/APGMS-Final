import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  assertBaseEventPayload,
} from "../../../shared/src/messaging/transactional-events.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

let storageRoot =
  process.env.LONG_TERM_STORAGE_ROOT ?? join(process.cwd(), "artifacts", "data-lake");
let defaultRetentionDays = Number.parseInt(
  process.env.LONG_TERM_STORAGE_RETENTION_DAYS ?? "365",
  10,
);

if (!Number.isFinite(defaultRetentionDays) || defaultRetentionDays <= 0) {
  defaultRetentionDays = 365;
}

export function configureStorage(options = {}) {
  if (options.root) {
    storageRoot = options.root;
  }

  if (
    typeof options.defaultRetentionDays === "number" &&
    Number.isFinite(options.defaultRetentionDays) &&
    options.defaultRetentionDays > 0
  ) {
    defaultRetentionDays = Math.floor(options.defaultRetentionDays);
  }
}

export function getStorageRoot() {
  return storageRoot;
}

function resolveTopicDirectory(topic) {
  const topicSegments = topic.split(".");
  return join(storageRoot, ...topicSegments);
}

function resolveRetentionDays(retentionDays) {
  if (
    typeof retentionDays === "number" &&
    Number.isFinite(retentionDays) &&
    retentionDays > 0
  ) {
    return Math.floor(retentionDays);
  }
  return defaultRetentionDays;
}

async function enforceRetention(directory, retentionDays) {
  const threshold = Date.now() - retentionDays * MS_PER_DAY;
  const entries = await readdir(directory, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isFile()) {
        return;
      }

      const filePath = join(directory, entry.name);
      const metadata = await stat(filePath);
      if (metadata.mtimeMs < threshold) {
        await rm(filePath, { force: true });
      }
    }),
  );
}

function buildFileName(payload) {
  const safeTimestamp = payload.occurredAt.replace(/[:]/g, "");
  return `${payload.eventId}_${safeTimestamp}.json`;
}

export async function persistTransactionalEvent(
  topic,
  payload,
  options = {},
) {
  assertBaseEventPayload(payload);

  if (options.qualityChecks) {
    for (const check of options.qualityChecks) {
      try {
        await check.validate(payload);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : JSON.stringify(error);
        throw new Error(`Quality check '${check.name}' failed: ${message}`);
      }
    }
  }

  const topicDirectory = resolveTopicDirectory(topic);
  await mkdir(topicDirectory, { recursive: true });

  const fileName = buildFileName(payload);
  const filePath = join(topicDirectory, fileName);
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");

  const retentionDays = resolveRetentionDays(options.retentionDays);
  await enforceRetention(topicDirectory, retentionDays);

  return filePath;
}
