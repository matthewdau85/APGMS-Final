import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  loadComplianceCalibrationFromDisk,
  complianceCalibrationSchema,
  type ComplianceCalibration,
} from "./lib/dataLoader.js";

const observationSchema = z.object({
  reportLagDays: z.number().nonnegative(),
  missingEvidence: z.number().nonnegative(),
  manualTouches: z.number().nonnegative(),
});

export type ComplianceObservation = z.infer<typeof observationSchema>;

let cachedCalibrationPromise: Promise<ComplianceCalibration> | undefined;

function computeLatency(observation: ComplianceObservation): number {
  return Number(
    (
      observation.reportLagDays +
      observation.missingEvidence * 4 +
      observation.manualTouches * 2
    ).toFixed(3)
  );
}

function stateFromLatency(
  latency: number,
  calibration: ComplianceCalibration
): "baseline" | "warning" | "breach" {
  if (latency >= calibration.latencyQuantiles.breach) {
    return "breach";
  }
  if (latency >= calibration.latencyQuantiles.warning) {
    return "warning";
  }
  return "baseline";
}

export async function loadComplianceCalibration(options: { prisma?: PrismaClient } = {}) {
  if (!cachedCalibrationPromise) {
    cachedCalibrationPromise = (async () => {
      if (options.prisma) {
        try {
          const record = await options.prisma.modelCalibration.findFirst({
            where: { domain: "compliance", name: "monitor" },
            orderBy: { createdAt: "desc" },
          });
          if (record?.parameters) {
            return complianceCalibrationSchema.parse(record.parameters);
          }
        } catch (error) {
          console.warn("compliance calibration lookup failed", error);
        }
      }
      return loadComplianceCalibrationFromDisk();
    })();
  }
  return cachedCalibrationPromise;
}

export function resetComplianceCalibrationCache() {
  cachedCalibrationPromise = undefined;
}

export async function evaluateCompliance(
  input: ComplianceObservation,
  options: { calibration?: ComplianceCalibration; prisma?: PrismaClient } = {}
) {
  const observation = observationSchema.parse(input);
  const calibration = options.calibration ?? (await loadComplianceCalibration({ prisma: options.prisma }));
  const latencyScore = computeLatency(observation);
  const state = stateFromLatency(latencyScore, calibration);

  return {
    state,
    latencyScore,
    thresholds: calibration.latencyQuantiles,
    averageLagDays: calibration.averageLagDays,
    autoCoverage: calibration.autoCoverage,
  };
}
