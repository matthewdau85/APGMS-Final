import { rm } from "node:fs/promises";
import { join } from "node:path";

async function main() {
  const dir = join(process.cwd(), "dist");
  try {
    await rm(dir, { recursive: true, force: true });
    console.log("[clean-dist] removed", dir);
  } catch (error) {
    console.warn("[clean-dist] failed to remove", dir, error);
  }
}

await main();
