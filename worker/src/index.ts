import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runNightlyDesignatedAccountReconciliation } from "./jobs/designated-reconciliation.js";
import { runAnalyticsFeatureAggregation } from "./jobs/build-analytics-features.js";

export { runNightlyDesignatedAccountReconciliation } from "./jobs/designated-reconciliation.js";
export { runAnalyticsFeatureAggregation } from "./jobs/build-analytics-features.js";

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;

const jobs: Record<string, () => Promise<void>> = {
  "designated:reconciliation": runNightlyDesignatedAccountReconciliation,
  "analytics:features": runAnalyticsFeatureAggregation,
};

if (invokedPath && resolve(modulePath) === invokedPath) {
  const jobName = process.argv[2] ?? "designated:reconciliation";
  const runner = jobs[jobName];

  if (!runner) {
    console.error(
      `Unknown worker job '${jobName}'. Available jobs: ${Object.keys(jobs).join(", ")}`,
    );
    process.exitCode = 1;
  } else {
    runner()
      .then(() => {
        process.stdout.write(`Worker job '${jobName}' completed\n`);
      })
      .catch((error) => {
        console.error(`Worker job '${jobName}' failed`, error);
        process.exitCode = 1;
      });
  }
}

