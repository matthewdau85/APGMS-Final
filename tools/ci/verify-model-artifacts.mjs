#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const root = resolve(process.env.MODEL_ARTIFACT_DIR ?? "artifacts/models");
const biasThreshold = Number(process.env.MODEL_BIAS_THRESHOLD ?? "0.02");

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function* walkModels(base) {
  const entries = await readdir(base, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(base, entry.name);
    if (entry.isDirectory()) {
      yield* walkModels(fullPath);
      continue;
    }
    if (entry.name === "manifest.json") {
      yield base;
    }
  }
}

async function sha256(filePath) {
  const data = await readFile(filePath);
  const hash = createHash("sha256");
  hash.update(data);
  return hash.digest("hex");
}

async function validateBiasReport(dir) {
  const reportPath = join(dir, "bias_report.json");
  if (!(await pathExists(reportPath))) {
    return [`Missing bias_report.json in ${relative(root, dir)}`];
  }
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  const metrics = report.metrics ?? {};
  const maxDelta = Number(metrics.max_difference ?? metrics.maxDelta ?? metrics.maxDeltaPercentage ?? 0);
  if (Number.isNaN(maxDelta)) {
    return [`bias_report.json missing max_difference metric in ${relative(root, dir)}`];
  }
  if (maxDelta > biasThreshold) {
    return [`Bias delta ${maxDelta} exceeds threshold ${biasThreshold} in ${relative(root, dir)}`];
  }
  return [];
}

async function validateTrainingRun(dir, manifest) {
  const runPath = join(dir, "training_run.json");
  if (!(await pathExists(runPath))) {
    return [`Missing training_run.json in ${relative(root, dir)}`];
  }
  const run = JSON.parse(await readFile(runPath, "utf8"));
  const problems = [];
  if (!run?.imageDigest || typeof run.imageDigest !== "string") {
    problems.push(`training_run.json missing imageDigest in ${relative(root, dir)}`);
  }
  if (!run?.datasetHash || typeof run.datasetHash !== "string") {
    problems.push(`training_run.json missing datasetHash in ${relative(root, dir)}`);
  }
  if (!run?.command || typeof run.command !== "string") {
    problems.push(`training_run.json missing command in ${relative(root, dir)}`);
  }
  if (manifest?.datasetHash && run.datasetHash && manifest.datasetHash !== run.datasetHash) {
    problems.push(
      `Dataset hash mismatch in ${relative(root, dir)} (manifest=${manifest.datasetHash}, training_run=${run.datasetHash})`,
    );
  }
  return problems;
}

async function validateManifest(dir) {
  const manifestPath = join(dir, "manifest.json");
  const contents = JSON.parse(await readFile(manifestPath, "utf8"));
  const problems = [];

  if (!contents.artifactPath) {
    problems.push(`manifest.json missing artifactPath in ${relative(root, dir)}`);
  }
  if (!contents.artifactSha256) {
    problems.push(`manifest.json missing artifactSha256 in ${relative(root, dir)}`);
  }
  if (!contents.signaturePath) {
    problems.push(`manifest.json missing signaturePath in ${relative(root, dir)}`);
  }

  const artifactPath = join(dir, contents.artifactPath ?? "");
  const signaturePath = join(dir, contents.signaturePath ?? "");

  if (!(await pathExists(artifactPath))) {
    problems.push(`Artifact file ${relative(dir, artifactPath)} not found in ${relative(root, dir)}`);
  }
  if (!(await pathExists(signaturePath))) {
    problems.push(`Signature file ${relative(dir, signaturePath)} not found in ${relative(root, dir)}`);
  }

  if (await pathExists(artifactPath) && contents.artifactSha256) {
    const calculated = await sha256(artifactPath);
    if (calculated !== contents.artifactSha256) {
      problems.push(
        `Artifact checksum mismatch in ${relative(root, dir)} (expected ${contents.artifactSha256}, got ${calculated})`,
      );
    }
  }

  return { manifest: contents, problems };
}

async function main() {
  if (!(await pathExists(root))) {
    console.warn(`Model artifact directory ${root} does not exist. Skipping checks.`);
    return;
  }

  const visited = new Set();
  for await (const dir of walkModels(root)) {
    visited.add(dir);
  }

  if (visited.size === 0) {
    console.warn(`No manifests found under ${root}. Skipping checks.`);
    return;
  }

  const failures = [];
  for (const dir of Array.from(visited)) {
    const { manifest, problems } = await validateManifest(dir);
    failures.push(...problems);
    failures.push(...(await validateBiasReport(dir)));
    failures.push(...(await validateTrainingRun(dir, manifest)));
  }

  if (failures.length > 0) {
    console.error("Model artifact validation failed:");
    for (const failure of failures) {
      console.error(` • ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Validated ${visited.size} model artifact${visited.size === 1 ? "" : "s"} under ${relative(process.cwd(), root)}`);
}

main().catch((error) => {
  console.error("verify-model-artifacts: unexpected error", error);
  process.exit(1);
});
