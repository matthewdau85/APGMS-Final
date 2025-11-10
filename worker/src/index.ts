import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runNightlyDesignatedAccountReconciliation } from "./jobs/designated-reconciliation.js";
import { runMlGovernanceSweep } from "./jobs/ml-governance.js";
import { runAutomatedKeyRotation } from "./jobs/key-rotation.js";

export { runNightlyDesignatedAccountReconciliation } from "./jobs/designated-reconciliation.js";
export { runMlGovernanceSweep } from "./jobs/ml-governance.js";
export { runAutomatedKeyRotation } from "./jobs/key-rotation.js";

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;

if (invokedPath && resolve(modulePath) === invokedPath) {
  const command = process.argv[2] ?? "designated-reconciliation";

  const run = async () => {
    switch (command) {
      case "designated-reconciliation":
        await runNightlyDesignatedAccountReconciliation();
        process.stdout.write("Designated account reconciliation completed\n");
        break;
      case "ml-governance":
        await runMlGovernanceSweep();
        process.stdout.write("ML governance sweep completed\n");
        break;
      case "key-rotation":
        await runAutomatedKeyRotation();
        process.stdout.write("Key rotation automation completed\n");
        break;
      default:
        throw new Error(`Unknown worker command: ${command}`);
    }
  };

  run().catch((error) => {
    console.error(`${command} job failed`, error);
    process.exitCode = 1;
  });
}

