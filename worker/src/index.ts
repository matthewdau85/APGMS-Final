import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runNightlyDesignatedAccountReconciliation } from "./jobs/designated-reconciliation.js";
import { runMonitoringSnapshotRetentionSweep } from "./jobs/monitoring-retention.js";

export { runNightlyDesignatedAccountReconciliation } from "./jobs/designated-reconciliation.js";
export { runMonitoringSnapshotRetentionSweep } from "./jobs/monitoring-retention.js";

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;

if (invokedPath && resolve(modulePath) === invokedPath) {
  (async () => {
    await runNightlyDesignatedAccountReconciliation();
    process.stdout.write("Designated account reconciliation completed\n");

    const { deleted, cutoff } = await runMonitoringSnapshotRetentionSweep({
      logger: console,
    });
    process.stdout.write(
      `Monitoring snapshot retention sweep removed ${deleted} record(s) prior to ${cutoff.toISOString()}\n`,
    );
  })().catch((error) => {
    console.error("Worker execution failed", error);
    process.exitCode = 1;
  });
}

