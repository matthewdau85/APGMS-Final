import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../..");
const riskDataDir = path.join(repoRoot, "data", "risk");

export const riskDataPointSchema = z.object({
  orgId: z.string(),
  taxType: z.string(),
  anomalyScore: z.number().nonnegative(),
  exposure: z.number().nonnegative(),
  recentIncidents: z.number().nonnegative(),
  signalToNoise: z.number().positive(),
});

export type RiskDataPoint = z.infer<typeof riskDataPointSchema>;

const riskDatasetSchema = z.array(riskDataPointSchema);

export const riskCalibrationSchema = z.object({
  version: z.string(),
  quantiles: z.object({
    moderate: z.number(),
    elevated: z.number(),
    severe: z.number(),
  }),
  smoothingFactor: z.number(),
  exposureBaseline: z.number(),
  features: z.array(z.string()),
  driftWindowDays: z.number().int(),
});

export type RiskCalibration = z.infer<typeof riskCalibrationSchema>;

async function loadJson<T>(fileName: string, schema: z.ZodType<T>): Promise<T> {
  const filePath = path.join(riskDataDir, fileName);
  const raw = await fs.readFile(filePath, "utf-8");
  return schema.parse(JSON.parse(raw));
}

export async function loadRiskDataset(): Promise<RiskDataPoint[]> {
  return loadJson("portfolio.json", riskDatasetSchema);
}

export async function loadRiskCalibrationFromDisk(): Promise<RiskCalibration> {
  return loadJson("calibration.json", riskCalibrationSchema);
}
