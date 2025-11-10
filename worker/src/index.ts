import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runNightlyDesignatedAccountReconciliation } from "./jobs/designated-reconciliation.js";
import { runScheduledAtoSubmissions } from "./jobs/ato-filings.js";

export { runNightlyDesignatedAccountReconciliation } from "./jobs/designated-reconciliation.js";
export { runScheduledAtoSubmissions } from "./jobs/ato-filings.js";

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;

if (invokedPath && resolve(modulePath) === invokedPath) {
  runNightlyDesignatedAccountReconciliation()
    .then(() => runScheduledAtoSubmissions())
    .then(() => {
      process.stdout.write("Worker jobs completed\n");
    })
    .catch((error) => {
      console.error("Worker jobs failed", error);
      process.exitCode = 1;
    });
}

