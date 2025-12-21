import { readFileSync } from "node:fs";
import { join } from "node:path";

const INFRA_PACKAGES = [
  "packages/ledger",
  "services/api-gateway",
  "worker"
];

let failed = false;

for (const pkgPath of INFRA_PACKAGES) {
  try {
    const pkgJson = JSON.parse(
      readFileSync(join(pkgPath, "package.json"), "utf8")
    );

    const testScript = pkgJson.scripts?.test ?? "";

    if (testScript.includes("--coverage")) {
      console.error(
        `❌ Infra package ${pkgPath} enables coverage in test script`
      );
      failed = true;
    }
  } catch {
    // ignore missing packages
  }
}

if (failed) {
  console.error("\nCoverage is forbidden for infra packages.");
  process.exit(1);
}

console.log("✅ Infra coverage guard passed");