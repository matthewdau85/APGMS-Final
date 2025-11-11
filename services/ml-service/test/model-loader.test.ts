import { strict as assert } from "node:assert";
import { copyFile, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { loadModelRegistry } from "../src/model-loader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const modelsDir = resolve(__dirname, "../models");
const manifestPath = join(modelsDir, "manifest.json");
const signaturePath = join(modelsDir, "manifest.json.sig");
const publicKeyPath = join(modelsDir, "public.pem");

async function createTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

test("loadModelRegistry returns validated models", async () => {
  const registry = await loadModelRegistry(manifestPath, signaturePath, publicKeyPath);

  assert.equal(registry.issuedAt, "2025-02-01T00:00:00.000Z");
  assert.equal(registry.models.size, 3);

  const fraudModel = registry.models.get("risk-fraud");
  assert.ok(fraudModel);
  assert.equal(fraudModel.type, "logistic_regression");
  assert.equal(typeof fraudModel.threshold, "number");
  assert.ok(Object.keys(fraudModel.coefficients).length > 0);
});

test("loadModelRegistry rejects manifests with invalid signatures", async () => {
  const tempDir = await createTempDir("ml-manifest-invalid-");
  const tamperedManifest = join(tempDir, "manifest.json");
  const tamperedSignature = join(tempDir, "manifest.json.sig");
  const tamperedKey = join(tempDir, "public.pem");

  const manifestRaw = JSON.parse(await readFile(manifestPath, "utf8"));
  manifestRaw.issuedAt = "2025-03-01T00:00:00.000Z";
  await writeFile(tamperedManifest, JSON.stringify(manifestRaw, null, 2));
  await copyFile(signaturePath, tamperedSignature);
  await copyFile(publicKeyPath, tamperedKey);

  await assert.rejects(
    () => loadModelRegistry(tamperedManifest, tamperedSignature, tamperedKey),
    /Model manifest signature invalid/,
  );
});

test("loadModelRegistry detects tampered model files via hash validation", async () => {
  const tempDir = await createTempDir("ml-model-hash-");
  const manifestCopy = join(tempDir, "manifest.json");
  const signatureCopy = join(tempDir, "manifest.json.sig");
  const keyCopy = join(tempDir, "public.pem");

  await copyFile(manifestPath, manifestCopy);
  await copyFile(signaturePath, signatureCopy);
  await copyFile(publicKeyPath, keyCopy);

  for (const file of [
    "risk-shortfall.model.json",
    "risk-fraud.model.json",
    "plan-compliance.model.json",
  ]) {
    await copyFile(join(modelsDir, file), join(tempDir, file));
  }

  const tamperedModelPath = join(tempDir, "risk-shortfall.model.json");
  const tamperedModel = JSON.parse(await readFile(tamperedModelPath, "utf8"));
  tamperedModel.threshold = tamperedModel.threshold + 0.01;
  await writeFile(tamperedModelPath, JSON.stringify(tamperedModel, null, 2));

  await assert.rejects(
    () => loadModelRegistry(manifestCopy, signatureCopy, keyCopy),
    /hash mismatch/,
  );
});
