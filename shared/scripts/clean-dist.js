import { rm } from "node:fs/promises";
import { join } from "node:path";

const root = join(process.cwd(), "dist");
await rm(root, { recursive: true, force: true });
console.log("[shared/clean-dist] removed", root);

