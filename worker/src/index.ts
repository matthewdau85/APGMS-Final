import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runNightlyDesignatedAccountReconciliation } from "./jobs/designated-reconciliation.js";
import { startEventIngestionWorker } from "./jobs/event-ingestion.js";

export { runNightlyDesignatedAccountReconciliation } from "./jobs/designated-reconciliation.js";
export { startEventIngestionWorker } from "./jobs/event-ingestion.js";

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;

if (invokedPath && resolve(modulePath) === invokedPath) {
  const job = process.argv[2]?.trim() ?? "designated-reconciliation";

  if (job === "ingest-events") {
    startEventIngestionWorker()
      .then(() => {
        process.stdout.write("Event ingestion worker stopped\n");
      })
      .catch((error) => {
        console.error("Event ingestion worker failed", error);
        process.exitCode = 1;
      });
  } else {
    runNightlyDesignatedAccountReconciliation()
      .then(() => {
        process.stdout.write("Designated account reconciliation completed\n");
      })
      .catch((error) => {
        console.error("Designated account reconciliation failed", error);
        process.exitCode = 1;
      });
  }
}

