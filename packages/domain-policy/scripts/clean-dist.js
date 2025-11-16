import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, "..", "dist");

await rm(target, { recursive: true, force: true });
