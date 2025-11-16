import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  loadRiskDataset,
  riskCalibrationSchema,
  type RiskCalibration,
} from "../src/lib/dataLoader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const calibrationPath = path.join(repoRoot, "data", "risk", "calibration.json");

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

async function persistCalibration(calibration: RiskCalibration, prisma: PrismaClient) {
  try {
    if (!process.env.DATABASE_URL) {
      console.warn("DATABASE_URL not set, skipping prisma persistence");
      return;
    }
    await prisma.modelCalibration.create({
      data: {
        domain: "risk",
        name: "predictor",
        version: calibration.version,
        parameters: calibration,
      },
    });
  } catch (error) {
    console.warn("failed to persist risk calibration", error);
  }
}

async function main() {
  const dataset = await loadRiskDataset();
  const anomalyScores = dataset.map((point) => point.anomalyScore);
  const incidentsAverage = dataset.reduce((sum, point) => sum + point.recentIncidents, 0) / dataset.length;
  const exposureAverage = dataset.reduce((sum, point) => sum + point.exposure, 0) / dataset.length;
  const smoothingFactor = Number((1 / (1 + incidentsAverage)).toFixed(3));

  const calibration = riskCalibrationSchema.parse({
    version: new Date().toISOString(),
    quantiles: {
      moderate: Number(quantile(anomalyScores, 0.5).toFixed(3)),
      elevated: Number(quantile(anomalyScores, 0.8).toFixed(3)),
      severe: Number(quantile(anomalyScores, 0.95).toFixed(3)),
    },
    smoothingFactor,
    exposureBaseline: Number(exposureAverage.toFixed(2)),
    features: ["anomalyScore", "recentIncidents", "signalToNoise"],
    driftWindowDays: 14,
  });

  await fs.writeFile(calibrationPath, JSON.stringify(calibration, null, 2));
  const prisma = new PrismaClient();
  await persistCalibration(calibration, prisma);
  await prisma.$disconnect();

  console.log(`risk calibration updated at ${calibrationPath}`);
}

main().catch((error) => {
  console.error("risk training run failed", error);
  process.exitCode = 1;
});
