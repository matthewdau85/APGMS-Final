#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_DATA_DIRS = ["data/ml/training"];
const DEFAULT_STATE_FILE = "artifacts/ml/last_retrain.json";

async function readState(stateFile) {
  try {
    const raw = await fs.readFile(stateFile, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.lastRunEpochMs === "number") {
      return parsed.lastRunEpochMs;
    }
    if (typeof parsed.lastRunIso === "string") {
      const parsedTime = Date.parse(parsed.lastRunIso);
      if (!Number.isNaN(parsedTime)) {
        return parsedTime;
      }
    }
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      throw error;
    }
  }
  return 0;
}

async function collectFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const items = await Promise.all(
    entries.map(async entry => {
      const resolved = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectFiles(resolved);
      }
      if (entry.isFile()) {
        return [resolved];
      }
      return [];
    }),
  );
  return items.flat();
}

async function latestMTime(dir) {
  try {
    const stat = await fs.stat(dir);
    if (stat.isFile()) {
      return stat.mtimeMs;
    }
    if (stat.isDirectory()) {
      const files = await collectFiles(dir);
      if (files.length === 0) {
        return stat.mtimeMs;
      }
      const stats = await Promise.all(files.map(file => fs.stat(file)));
      return Math.max(...stats.map(s => s.mtimeMs));
    }
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return Number.NEGATIVE_INFINITY;
    }
    throw error;
  }
  return Number.NEGATIVE_INFINITY;
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function runCommand(command) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, stdio: "inherit" });
    child.on("exit", code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Retraining command exited with code ${code}`));
    });
    child.on("error", error => reject(error));
  });
}

async function main() {
  const dataDirs = (process.env.ML_TRAINING_DIRS || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
  const dirsToCheck = dataDirs.length > 0 ? dataDirs : DEFAULT_DATA_DIRS;
  const stateFile = process.env.ML_RETRAIN_STATE_FILE || DEFAULT_STATE_FILE;
  const command = process.env.ML_RETRAIN_COMMAND;

  if (!command) {
    throw new Error("ML_RETRAIN_COMMAND must be provided to trigger retraining");
  }

  const latestDataTimes = await Promise.all(dirsToCheck.map(latestMTime));
  const latestDataMtime = Math.max(...latestDataTimes);

  if (!Number.isFinite(latestDataMtime) || latestDataMtime < 0) {
    console.log("[ml-retrain] No training data found. Skipping retraining.");
    return;
  }

  const lastRun = await readState(stateFile);
  if (lastRun >= latestDataMtime) {
    console.log("[ml-retrain] Training data has not changed since last run. Skipping retraining.");
    return;
  }

  console.log(`[ml-retrain] New training data detected (mtime: ${new Date(latestDataMtime).toISOString()}).`);
  console.log(`[ml-retrain] Executing retraining command: ${command}`);
  await runCommand(command);

  const now = Date.now();
  await ensureDir(stateFile);
  await fs.writeFile(
    stateFile,
    JSON.stringify(
      {
        lastRunEpochMs: now,
        lastRunIso: new Date(now).toISOString(),
        latestDataEpochMs: latestDataMtime,
        retrainCommand: command,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log("[ml-retrain] Retraining metadata written to", stateFile);
}

main().catch(error => {
  console.error("[ml-retrain] Retraining orchestration failed", error);
  process.exitCode = 1;
});
