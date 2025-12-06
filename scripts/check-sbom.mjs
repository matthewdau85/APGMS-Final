// scripts/check-sbom.mjs
import { stat } from "node:fs/promises";
import { resolve } from "node:path";

async function main() {
  const sbomPath = resolve("sbom.xml");

  try {
    const s = await stat(sbomPath);

    if (!s.isFile()) {
      console.error(`[check-sbom] ${sbomPath} exists but is not a regular file`);
      process.exit(1);
    }

    if (s.size < 1024) {
      console.error(
        `[check-sbom] ${sbomPath} is too small (${s.size} bytes) – SBOM likely incomplete`
      );
      process.exit(1);
    }

    console.log(
      `[check-sbom] OK: ${sbomPath} exists and is ${s.size} bytes – treating SBOM step as passed`
    );
    process.exit(0);
  } catch (err) {
    console.error(
      `[check-sbom] ERROR: ${sbomPath} not found or unreadable: ${err.message}`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[check-sbom] FATAL: ${err.message}`);
  process.exit(1);
});
