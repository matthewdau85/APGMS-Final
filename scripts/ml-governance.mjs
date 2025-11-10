#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const VALID_CHECKS = new Set(["integrity", "bias", "drift", "security"]);

function usage() {
  console.error("Usage: node scripts/ml-governance.mjs --check <integrity|bias|drift|security>");
  process.exit(1);
}

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  if (key === "--check") {
    const value = process.argv[i + 1];
    if (!value) usage();
    args.set("check", value);
    i += 1;
  }
}

const check = args.get("check");
if (!check || !VALID_CHECKS.has(check)) {
  usage();
}

const manifestPath = resolve("artifacts/ml/model-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const models = Array.isArray(manifest.models) ? manifest.models : [];

if (models.length === 0) {
  console.error("No models found in manifest");
  process.exit(1);
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

switch (check) {
  case "integrity": {
    for (const model of models) {
      ensure(typeof model.modelId === "string", "modelId missing");
      ensure(typeof model.version === "string", `version missing for ${model.modelId}`);
      ensure(typeof model.artifactSha256 === "string", `artifactSha256 missing for ${model.modelId}`);
      ensure(
        /^[a-f0-9]{64}$/i.test(model.artifactSha256),
        `artifactSha256 must be 64 hex chars for ${model.modelId}`,
      );
    }
    await writeFile(
      resolve("artifacts", "model-integrity.json"),
      JSON.stringify({ checkedAt: new Date().toISOString(), models: models.length }, null, 2),
    );
    break;
  }
  case "bias": {
    for (const model of models) {
      const bias = model.biasMetrics ?? {};
      ensure(typeof bias.demographicParity === "number", `bias.demographicParity missing for ${model.modelId}`);
      ensure(
        bias.demographicParity <= 0.1,
        `Bias threshold exceeded for ${model.modelId}`,
      );
    }
    await writeFile(
      resolve("artifacts", "bias-report.json"),
      JSON.stringify({ checkedAt: new Date().toISOString(), models: models.length }, null, 2),
    );
    break;
  }
  case "drift": {
    for (const model of models) {
      const drift = model.driftMetrics ?? {};
      ensure(typeof drift.psi === "number", `drift.psi missing for ${model.modelId}`);
      ensure(drift.psi < 0.2, `Drift PSI too high for ${model.modelId}`);
    }
    await writeFile(
      resolve("artifacts", "drift-scan.json"),
      JSON.stringify({ checkedAt: new Date().toISOString(), models: models.length }, null, 2),
    );
    break;
  }
  case "security": {
    for (const model of models) {
      const security = model.security ?? {};
      ensure(typeof security.scanTimestamp === "string", `security.scanTimestamp missing for ${model.modelId}`);
      ensure(Array.isArray(security.dependencyFindings), `dependencyFindings missing for ${model.modelId}`);
    }
    await writeFile(
      resolve("artifacts", "model-security.json"),
      JSON.stringify({ checkedAt: new Date().toISOString(), models: models.length }, null, 2),
    );
    break;
  }
  default:
    usage();
}

console.log(`ML governance check '${check}' passed`);
