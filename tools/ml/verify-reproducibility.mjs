import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const reportPath = resolve("artifacts/model/reproducibility-report.json");

async function main() {
  const raw = await readFile(reportPath, "utf8");
  const report = JSON.parse(raw);

  if (!report.passed) {
    throw new Error("Reproducibility report flagged issues. Investigate before deployment.");
  }

  const requiredFields = ["datasetSnapshot", "datasetHash", "trainingCommit"];
  for (const field of requiredFields) {
    if (!report[field]) {
      throw new Error(`Reproducibility report is missing required field: ${field}`);
    }
  }

  console.log("✔ Reproducibility controls satisfied");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
