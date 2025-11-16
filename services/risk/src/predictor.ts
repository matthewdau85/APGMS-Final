import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  loadRiskCalibrationFromDisk,
  riskCalibrationSchema,
  type RiskCalibration,
} from "./lib/dataLoader.js";

const observationSchema = z.object({
  anomalyScore: z.number().nonnegative(),
  recentIncidents: z.number().nonnegative(),
  signalToNoise: z.number().positive(),
});

export type RiskObservation = z.infer<typeof observationSchema>;

let cachedCalibrationPromise: Promise<RiskCalibration> | undefined;

function computeScore(observation: RiskObservation, smoothingFactor: number): number {
  const normalizedNoise = 1 / Math.max(observation.signalToNoise, 0.1);
  const incidentPenalty = observation.recentIncidents * 0.05;
  return Number(
    (
      observation.anomalyScore * smoothingFactor +
      normalizedNoise * 0.1 +
      incidentPenalty
    ).toFixed(3)
  );
}

function classify(score: number, calibration: RiskCalibration): "baseline" | "moderate" | "elevated" | "severe" {
  if (score >= calibration.quantiles.severe) {
    return "severe";
  }
  if (score >= calibration.quantiles.elevated) {
    return "elevated";
  }
  if (score >= calibration.quantiles.moderate) {
    return "moderate";
  }
  return "baseline";
}

export async function loadRiskCalibration(options: { prisma?: PrismaClient } = {}): Promise<RiskCalibration> {
  if (!cachedCalibrationPromise) {
    cachedCalibrationPromise = (async () => {
      if (options.prisma) {
        try {
          const record = await options.prisma.modelCalibration.findFirst({
            where: { domain: "risk", name: "predictor" },
            orderBy: { createdAt: "desc" },
          });
          if (record?.parameters) {
            return riskCalibrationSchema.parse(record.parameters);
          }
        } catch (error) {
          console.warn("risk calibration lookup failed, falling back to disk", error);
        }
      }
      return loadRiskCalibrationFromDisk();
    })();
  }
  return cachedCalibrationPromise;
}

export function resetRiskCalibrationCache() {
  cachedCalibrationPromise = undefined;
}

export async function evaluateRisk(
  input: RiskObservation,
  options: { calibration?: RiskCalibration; prisma?: PrismaClient } = {}
) {
  const observation = observationSchema.parse(input);
  const calibration = options.calibration ?? (await loadRiskCalibration({ prisma: options.prisma }));
  const score = computeScore(observation, calibration.smoothingFactor);
  const bucket = classify(score, calibration);
  return {
    bucket,
    score,
    thresholds: calibration.quantiles,
    exposureBaseline: calibration.exposureBaseline,
  };
}
