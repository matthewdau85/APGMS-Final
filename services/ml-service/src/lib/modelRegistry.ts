import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { z } from "zod";

const featureSchema = z.object({
  key: z.string(),
  weight: z.number(),
  description: z.string().optional()
});

const explanationSchema = z.record(
  z.object({
    low: z.string(),
    high: z.string()
  })
);

const modelSchema = z.object({
  name: z.string(),
  version: z.string(),
  type: z.enum(["risk", "plan"]),
  threshold: z.number().min(0).max(1),
  bias: z.number(),
  features: z.array(featureSchema).nonempty(),
  explanations: explanationSchema,
  driftBaseline: z.record(z.number()),
  driftTolerance: z.number().min(0),
  fairness: z.object({
    protected: z.string(),
    maxDelta: z.number().min(0)
  })
});

const catalogSchema = z.object({
  models: z.array(modelSchema)
});

export type ModelDefinition = z.infer<typeof modelSchema>;

let modelsByName: Map<string, ModelDefinition> | null = null;

export async function loadCatalog(): Promise<Map<string, ModelDefinition>> {
  if (modelsByName) return modelsByName;

  const here = dirname(fileURLToPath(import.meta.url));
  const catalogPath = join(here, "..", "..", "models", "catalog.json");
  const raw = await readFile(catalogPath, "utf-8");
  const parsed = catalogSchema.parse(JSON.parse(raw));

  modelsByName = new Map(parsed.models.map((model) => [model.name, model]));
  return modelsByName;
}

export async function requireModel(name: string): Promise<ModelDefinition> {
  const catalog = await loadCatalog();
  const model = catalog.get(name);
  if (!model) {
    throw new Error(`Model ${name} not found in catalog`);
  }
  return model;
}

export function resetCatalog(): void {
  modelsByName = null;
}
