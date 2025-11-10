import { loadCatalog } from "../src/lib/modelRegistry.js";

async function main() {
  const catalog = await loadCatalog();
  const table: Array<{ model: string; tolerance: number }> = [];
  for (const model of catalog.values()) {
    table.push({ model: model.name, tolerance: model.driftTolerance });
  }

  console.table(table);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
