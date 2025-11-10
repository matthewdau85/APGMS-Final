import { loadCatalog } from "../src/lib/modelRegistry.js";

async function main() {
  const catalog = await loadCatalog();
  const issues: string[] = [];

  for (const model of catalog.values()) {
    if (model.features.length === 0) {
      issues.push(`${model.name} has no features defined`);
    }

    const baselineKeys = new Set(Object.keys(model.driftBaseline));
    for (const feature of model.features) {
      if (!baselineKeys.has(feature.key)) {
        issues.push(`${model.name} missing drift baseline for ${feature.key}`);
      }
      if (!model.explanations[feature.key]) {
        issues.push(`${model.name} missing explanation copy for ${feature.key}`);
      }
    }
  }

  if (issues.length > 0) {
    console.error("Model validation failed:\n" + issues.map((msg) => ` - ${msg}`).join("\n"));
    process.exitCode = 1;
    return;
  }

  console.log(`Validated ${catalog.size} models`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
