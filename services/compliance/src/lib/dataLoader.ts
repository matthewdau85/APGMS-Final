import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../..");
const complianceDataDir = path.join(repoRoot, "data", "compliance");

export const complianceDataPointSchema = z.object({
  orgId: z.string(),
  taxType: z.string(),
  reportLagDays: z.number().nonnegative(),
  missingEvidence: z.number().nonnegative(),
  manualTouches: z.number().nonnegative(),
});

export type ComplianceDataPoint = z.infer<typeof complianceDataPointSchema>;

const complianceDatasetSchema = z.array(complianceDataPointSchema);

export const complianceCalibrationSchema = z.object({
  version: z.string(),
  latencyQuantiles: z.object({
    baseline: z.number(),
    warning: z.number(),
    breach: z.number(),
  }),
  averageLagDays: z.number(),
  autoCoverage: z.number(),
  features: z.array(z.string()),
  driftWindowDays: z.number().int(),
});

export type ComplianceCalibration = z.infer<typeof complianceCalibrationSchema>;

async function loadJson<T>(fileName: string, schema: z.ZodType<T>): Promise<T> {
  const filePath = path.join(complianceDataDir, fileName);
  const raw = await fs.readFile(filePath, "utf-8");
  return schema.parse(JSON.parse(raw));
}

export async function loadComplianceDataset(): Promise<ComplianceDataPoint[]> {
  return loadJson("obligations.json", complianceDatasetSchema);
}

export async function loadComplianceCalibrationFromDisk(): Promise<ComplianceCalibration> {
  return loadJson("calibration.json", complianceCalibrationSchema);
}
