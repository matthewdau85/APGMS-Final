import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { startComplianceIngestor } from "./service.js";

export { startComplianceIngestor } from "./service.js";

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;

if (invokedPath && resolve(modulePath) === invokedPath) {
  startComplianceIngestor().catch((error) => {
    console.error("Compliance ingestor failed", error);
    process.exitCode = 1;
  });
}
