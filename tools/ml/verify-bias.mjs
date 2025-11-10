import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const reportPath = resolve("artifacts/model/bias-report.json");

async function main() {
  const raw = await readFile(reportPath, "utf8");
  const report = JSON.parse(raw);

  if (report.status !== "pass") {
    throw new Error(`Bias evaluation failed with status: ${report.status}`);
  }

  for (const [metric, value] of Object.entries(report.metrics ?? {})) {
    const threshold = report.thresholds?.[metric];
    if (typeof threshold === "number" && Math.abs(value) > threshold) {
      throw new Error(
        `${metric} of ${value} exceeds threshold ${threshold}. Investigate fairness regression.`,
      );
    }
  }

  console.log("✔ Bias report passes configured thresholds");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
