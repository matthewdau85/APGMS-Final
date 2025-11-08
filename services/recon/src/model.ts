import { promises as fs } from "node:fs";
import { basename, join } from "node:path";

import { config } from "./config.js";
import type { ReconModel } from "./types.js";

let cachedModel: ReconModel | null = null;
let cachedFile: string | null = null;

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function listCandidateFiles(): Promise<string[]> {
  try {
    const entries = await fs.readdir(config.modelDirectory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => join(config.modelDirectory, entry.name))
      .sort((a, b) => basename(a).localeCompare(b));
  } catch (error) {
    throw new Error(`Failed to read model directory '${config.modelDirectory}': ${String(error)}`);
  }
}

export async function loadLatestModel(): Promise<ReconModel> {
  const files = await listCandidateFiles();
  if (files.length === 0) {
    throw new Error(`No model artefacts found in ${config.modelDirectory}`);
  }

  const latest = files[files.length - 1];
  if (cachedModel && cachedFile === latest) {
    return cachedModel;
  }

  const model = await readJson<ReconModel>(latest);
  cachedModel = model;
  cachedFile = latest;
  return model;
}

export function invalidateModelCache(): void {
  cachedModel = null;
  cachedFile = null;
}
