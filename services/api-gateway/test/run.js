import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const rootDir = fileURLToPath(new URL(".", import.meta.url));
async function collectSpecFiles(dir) {
    const entries = await readdir(dir);
    const results = [];
    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const info = await stat(fullPath);
        if (info.isDirectory()) {
            const nested = await collectSpecFiles(fullPath);
            results.push(...nested);
            continue;
        }
        if (entry.toLowerCase().endsWith(".spec.ts")) {
            results.push(fullPath);
        }
    }
    return results;
}
async function loadSpecs() {
    const files = await collectSpecFiles(rootDir);
    for (const file of files) {
        await import(pathToFileURL(file).href);
    }
}
await loadSpecs();
