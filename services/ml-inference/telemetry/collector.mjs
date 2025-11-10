import { promises as fs } from "node:fs";
import path from "node:path";

const TELEMETRY_DIR = "artifacts/ml/telemetry";
const SNAPSHOT_FILE = path.join(TELEMETRY_DIR, "drift-dashboard.json");

function resolveWindowSize() {
  const raw = process.env.ML_TELEMETRY_WINDOW || "1440";
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1440; // default window in minutes
  }
  return parsed;
}

async function loadExistingSnapshot() {
  try {
    const contents = await fs.readFile(SNAPSHOT_FILE, "utf8");
    return JSON.parse(contents);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function buildWindow(now, windowMinutes) {
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);
  return { start: windowStart.toISOString(), end: new Date(now).toISOString() };
}

export async function publishTelemetrySnapshot(payload) {
  const now = new Date();
  const windowMinutes = resolveWindowSize();
  const window = buildWindow(now, windowMinutes);

  const previous = (await loadExistingSnapshot()) ?? {};
  const history = Array.isArray(previous.history) ? previous.history : [];
  const filteredHistory = history.filter(entry => {
    if (!entry?.window?.end) {
      return false;
    }
    return Date.parse(entry.window.end) > Date.parse(window.start);
  });

  const snapshot = {
    generatedAt: now.toISOString(),
    windowMinutes,
    window,
    modelVersion: payload.modelVersion,
    metrics: payload.metrics,
    trainingHash: payload.trainingHash,
    dataSummary: payload.dataSummary,
    history: [
      ...filteredHistory,
      {
        window,
        modelVersion: payload.modelVersion,
        metrics: payload.metrics,
        trainingHash: payload.trainingHash,
        exportedAt: now.toISOString(),
      },
    ],
  };

  await fs.mkdir(TELEMETRY_DIR, { recursive: true });
  await fs.writeFile(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2), "utf8");
  return snapshot;
}
