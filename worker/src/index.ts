import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runNightlyDesignatedAccountReconciliation } from "./jobs/designated-reconciliation.js";

export { runNightlyDesignatedAccountReconciliation } from "./jobs/designated-reconciliation.js";
export { startComplianceIngestor } from "../compliance-ingestor/index.js";

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;

if (invokedPath && resolve(modulePath) === invokedPath) {
  runNightlyDesignatedAccountReconciliation()
    .then(() => {
      process.stdout.write("Designated account reconciliation completed\n");
    })
    .catch((error) => {
      console.error("Designated account reconciliation failed", error);
      process.exitCode = 1;
    });
}

