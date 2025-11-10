import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runNightlyDesignatedAccountReconciliation } from "./jobs/designated-reconciliation.js";
import { processBasPaymentRetryQueue } from "./jobs/bas-payment-retry.js";

export { runNightlyDesignatedAccountReconciliation } from "./jobs/designated-reconciliation.js";
export { processBasPaymentRetryQueue } from "./jobs/bas-payment-retry.js";

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;

if (invokedPath && resolve(modulePath) === invokedPath) {
  const job = process.argv[2] ?? "reconciliation";
  if (job === "bas-retry") {
    processBasPaymentRetryQueue()
      .then(() => {
        process.stdout.write("BAS payment retry queue processed\n");
      })
      .catch((error) => {
        console.error("BAS payment retry processing failed", error);
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

