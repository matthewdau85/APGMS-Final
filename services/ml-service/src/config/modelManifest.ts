import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface FeatureStats {
  mean: number;
  stdDev: number;
}

export interface ModelManifest {
  modelId: string;
  version: string;
  provenance: {
    registry: string;
    gitCommit: string;
    trainingDataset: string;
    featureStoreSnapshot: string;
    generatedAt: string;
    approvedBy: string;
  };
  checksum: {
    artifactPath: string;
    sha256: string;
  };
  slo: {
    targetErrorRate: number;
    windowHours: number;
  };
  baselineFeatureStats: Record<string, FeatureStats>;
}

function loadManifest(): ModelManifest {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const manifestPath = path.join(__dirname, '..', '..', 'model', 'manifest.json');
  const raw = readFileSync(manifestPath, 'utf8');
  return JSON.parse(raw) as ModelManifest;
}

export const modelManifest = loadManifest();
