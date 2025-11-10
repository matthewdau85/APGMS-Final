#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

async function readJson(relativePath) {
  const filePath = path.join(root, relativePath);
  const buf = await readFile(filePath, 'utf8');
  try {
    return JSON.parse(buf);
  } catch (err) {
    throw new Error(`Failed to parse JSON ${relativePath}: ${err.message}`);
  }
}

async function ensureManifest() {
  const manifest = await readJson('model/manifest.json');
  const requiredRootFields = ['modelId', 'version', 'provenance', 'checksum', 'slo'];
  for (const field of requiredRootFields) {
    if (!(field in manifest)) {
      throw new Error(`model/manifest.json is missing required field \"${field}\"`);
    }
  }

  const requiredProvenance = ['registry', 'gitCommit', 'trainingDataset', 'featureStoreSnapshot', 'generatedAt', 'approvedBy'];
  for (const field of requiredProvenance) {
    if (!manifest.provenance?.[field]) {
      throw new Error(`Provenance metadata missing \"${field}\"`);
    }
  }

  if (typeof manifest.slo?.targetErrorRate !== 'number' || manifest.slo.targetErrorRate <= 0) {
    throw new Error('SLO targetErrorRate must be a positive number');
  }

  if (!manifest.baselineFeatureStats || typeof manifest.baselineFeatureStats !== 'object') {
    throw new Error('baselineFeatureStats must be defined for drift monitoring');
  }

  return manifest;
}

async function ensureBiasReport(manifest) {
  const report = await readJson('reports/latest-bias-report.json');
  if (report.modelId !== manifest.modelId || report.version !== manifest.version) {
    throw new Error('Bias report must align with manifest modelId/version');
  }
  if (!report.approved) {
    throw new Error('latest-bias-report.json is not approved');
  }
  const parity = Number(report.metrics?.maxParityDifference ?? NaN);
  const parityThreshold = Number(report.thresholds?.maxParityDifference ?? NaN);
  if (!Number.isFinite(parity) || !Number.isFinite(parityThreshold)) {
    throw new Error('Bias report must include maxParityDifference metric and threshold');
  }
  if (parity > parityThreshold) {
    throw new Error(`Parity difference ${parity} exceeds threshold ${parityThreshold}`);
  }
  const air = Number(report.metrics?.adverseImpactRatio ?? NaN);
  const airThreshold = Number(report.thresholds?.adverseImpactRatio ?? NaN);
  if (!Number.isFinite(air) || !Number.isFinite(airThreshold)) {
    throw new Error('Bias report must include adverseImpactRatio metric and threshold');
  }
  if (air < airThreshold) {
    throw new Error(`Adverse impact ratio ${air} below threshold ${airThreshold}`);
  }
}

async function ensureChecksum(manifest) {
  const artifactPath = manifest.checksum?.artifactPath;
  const expectedSha = manifest.checksum?.sha256;
  if (!artifactPath || !expectedSha) {
    throw new Error('Manifest checksum section must include artifactPath and sha256');
  }
  const modelFile = path.join(root, artifactPath);
  const checksumFile = path.join(root, 'checksums', path.basename(artifactPath) + '.sha256');

  const artifactData = await readFile(modelFile);
  const actualSha = createHash('sha256').update(artifactData).digest('hex');
  if (actualSha !== expectedSha) {
    throw new Error(`Manifest sha256 mismatch. Expected ${expectedSha} but computed ${actualSha}`);
  }

  const checksumText = await readFile(checksumFile, 'utf8');
  const expectedLine = `${expectedSha}  ${path.basename(artifactPath)}`;
  if (!checksumText.trim().split(/\s+/).includes(expectedSha) || !checksumText.includes(path.basename(artifactPath))) {
    throw new Error(`Checksum file ${path.relative(root, checksumFile)} does not contain expected entry`);
  }
}

(async function main() {
  try {
    const manifest = await ensureManifest();
    await ensureBiasReport(manifest);
    await ensureChecksum(manifest);
    console.log('ML governance checks passed');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();
