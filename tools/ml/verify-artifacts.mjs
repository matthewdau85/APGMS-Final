import { createHash } from "node:crypto";
import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const manifestPath = resolve("artifacts/model/manifest.json");

async function ensureFile(path) {
  try {
    await access(path);
  } catch (error) {
    throw new Error(`Missing required file: ${path}\n${error}`);
  }
}

async function hashFile(path) {
  const buffer = await readFile(path);
  const hash = createHash("sha256");
  hash.update(buffer);
  return hash.digest("hex");
}

async function main() {
  await ensureFile(manifestPath);
  const manifestRaw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw);

  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    throw new Error("Manifest must describe at least one artifact entry");
  }

  for (const artifact of manifest.artifacts) {
    const path = resolve(artifact.path);
    await ensureFile(path);
    const actual = await hashFile(path);
    if (actual !== artifact.sha256) {
      throw new Error(
        `SHA mismatch for ${artifact.path}. Expected ${artifact.sha256} but found ${actual}`,
      );
    }
  }

  console.log("✔ Model artifact integrity verified");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
