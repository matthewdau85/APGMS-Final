import { loadCatalog } from "../src/lib/modelRegistry.js";

async function main() {
  const catalog = await loadCatalog();
  const report: Array<{ model: string; protectedClass: string; maxDelta: number }> = [];

  for (const model of catalog.values()) {
    report.push({
      model: model.name,
      protectedClass: model.fairness.protected,
      maxDelta: model.fairness.maxDelta
    });
    if (model.fairness.maxDelta > 0.2) {
      throw new Error(`${model.name} fairness delta ${model.fairness.maxDelta} exceeds allowed 0.2`);
    }
  }

  console.table(report);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
