import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  loadComplianceDataset,
  complianceCalibrationSchema,
  type ComplianceCalibration,
} from "../src/lib/dataLoader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const calibrationPath = path.join(repoRoot, "data", "compliance", "calibration.json");

function quantile(values: number[], percentile: number) {
  if (values.length === 1) return values[0];
  const sorted = [...values].sort((a, b) => a - b);
  const rank = percentile * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];
  const weight = rank - lower;
  return sorted[lower] + weight * (sorted[upper] - sorted[lower]);
}

function latencyScore(row: { reportLagDays: number; missingEvidence: number; manualTouches: number }) {
  return row.reportLagDays + row.missingEvidence * 4 + row.manualTouches * 2;
}

async function persistCalibration(calibration: ComplianceCalibration, prisma: PrismaClient) {
  try {
    if (!process.env.DATABASE_URL) {
      console.warn("DATABASE_URL not set, skipping prisma persistence");
      return;
    }
    await prisma.modelCalibration.create({
      data: {
        domain: "compliance",
        name: "monitor",
        version: calibration.version,
        parameters: calibration,
      },
    });
  } catch (error) {
    console.warn("failed to persist compliance calibration", error);
  }
}

async function main() {
  const dataset = await loadComplianceDataset();
  const latencyValues = dataset.map(latencyScore);
  const averageLag = dataset.reduce((sum, row) => sum + row.reportLagDays, 0) / dataset.length;
  const averageManualTouches = dataset.reduce((sum, row) => sum + row.manualTouches, 0) / dataset.length;
  const autoCoverage = Number(Math.max(0, 1 - averageManualTouches / 4).toFixed(3));

  const calibration = complianceCalibrationSchema.parse({
    version: new Date().toISOString(),
    latencyQuantiles: {
      baseline: Number(quantile(latencyValues, 0.5).toFixed(3)),
      warning: Number(quantile(latencyValues, 0.8).toFixed(3)),
      breach: Number(quantile(latencyValues, 0.95).toFixed(3)),
    },
    averageLagDays: Number(averageLag.toFixed(3)),
    autoCoverage,
    features: ["reportLagDays", "missingEvidence", "manualTouches"],
    driftWindowDays: 21,
  });

  await fs.writeFile(calibrationPath, JSON.stringify(calibration, null, 2));
  const prisma = new PrismaClient();
  await persistCalibration(calibration, prisma);
  await prisma.$disconnect();
  console.log(`compliance calibration updated at ${calibrationPath}`);
}

main().catch((error) => {
  console.error("compliance training run failed", error);
  process.exitCode = 1;
});
