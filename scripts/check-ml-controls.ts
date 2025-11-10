import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

interface Controls {
  modelVersion: string;
  integrityChecksum: string;
  biasReportPath: string;
  driftWindowDays: number;
  securityScanPath: string;
  lastRetrainedAt: string;
  approvedBy: string[];
  rollbackModelVersion: string;
}

interface BiasReport {
  modelVersion: string;
  equalOpportunityGap: number;
  demographicParityRatio: number;
}

interface SecurityReport {
  modelVersion: string;
  trivyFindings: number;
  dependencyVulnerabilities: unknown[];
}

function ensure(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

async function loadJson<T>(filePath: string): Promise<T> {
  const fullPath = resolve(process.cwd(), filePath);
  const raw = await readFile(fullPath, "utf8");
  return JSON.parse(raw) as T;
}

async function checkIntegrity(controls: Controls): Promise<void> {
  ensure(controls.integrityChecksum.startsWith("sha256:"), "Integrity checksum must be a sha256 digest");
  ensure(controls.approvedBy.includes("risk_officer"), "Risk officer approval missing");
  ensure(controls.approvedBy.includes("ml_lead"), "ML lead approval missing");
}

async function checkBias(controls: Controls): Promise<void> {
  const biasReport = await loadJson<BiasReport>(controls.biasReportPath);
  ensure(biasReport.modelVersion === controls.modelVersion, "Bias report model version mismatch");
  ensure(biasReport.equalOpportunityGap <= 0.02, "Equal opportunity gap exceeds threshold");
  ensure(biasReport.demographicParityRatio >= 0.9, "Demographic parity ratio below minimum");
}

async function checkDrift(controls: Controls): Promise<void> {
  ensure(controls.driftWindowDays <= 14, "Drift window exceeds 14 days");
  const lastRetrained = new Date(controls.lastRetrainedAt);
  ensure(!Number.isNaN(lastRetrained.getTime()), "lastRetrainedAt must be a valid ISO timestamp");
}

async function checkSecurity(controls: Controls): Promise<void> {
  const report = await loadJson<SecurityReport>(controls.securityScanPath);
  ensure(report.modelVersion === controls.modelVersion, "Security scan model version mismatch");
  ensure(report.trivyFindings === 0, "Security scan reported findings");
}

async function main(): Promise<void> {
  const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
  if (!modeArg) {
    throw new Error("--mode argument is required");
  }
  const mode = modeArg.split("=")[1];
  const controls = await loadJson<Controls>("config/ml/controls.json");

  switch (mode) {
    case "integrity":
      await checkIntegrity(controls);
      break;
    case "bias":
      await checkBias(controls);
      break;
    case "drift":
      await checkDrift(controls);
      break;
    case "security":
      await checkSecurity(controls);
      break;
    default:
      throw new Error(`Unsupported mode ${mode}`);
  }

  console.log(`ML control check '${mode}' passed for version ${controls.modelVersion}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
