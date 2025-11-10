import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

type FieldDefinition = {
  name: string;
  type: string;
  isList: boolean;
  attributes: string[];
};

type ModelDefinition = {
  name: string;
  fields: FieldDefinition[];
};

type DatasetDefinition = {
  name: string;
  description: string;
  models: string[];
};

const DATASETS: DatasetDefinition[] = [
  {
    name: 'payroll_core',
    description: 'Employees, pay runs, and payslips needed for payroll analytics.',
    models: ['Employee', 'PayRun', 'Payslip', 'PayrollItem'],
  },
  {
    name: 'ledger_core',
    description: 'Core double-entry ledger postings, balances, and journals.',
    models: ['Organization', 'Account', 'Journal', 'Posting', 'BalanceSnapshot'],
  },
  {
    name: 'cashflow_support',
    description: 'Bank and GST transactions used for auxiliary reconciliation.',
    models: ['BankTransaction', 'GstTransaction', 'EventEnvelope'],
  },
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');

const SCHEMA_PATH = path.join(WORKSPACE_ROOT, 'shared/prisma/schema.prisma');
const ARTIFACT_DIR = path.join(WORKSPACE_ROOT, 'packages/model-service/artifacts');
const ARTIFACT_PATH = path.join(ARTIFACT_DIR, 'dataset-manifest.json');

function extractModels(schema: string): ModelDefinition[] {
  const modelRegex = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
  const models: ModelDefinition[] = [];
  let match: RegExpExecArray | null;

  while ((match = modelRegex.exec(schema)) !== null) {
    const [, modelName, body] = match;
    const fields: FieldDefinition[] = [];
    const lines = body.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) {
        continue;
      }

      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) {
        continue;
      }
      const [name, rawType, ...attributes] = parts;
      const isList = rawType.endsWith('[]');
      const type = isList ? rawType.slice(0, -2) : rawType;

      fields.push({
        name,
        type,
        isList,
        attributes,
      });
    }

    models.push({
      name: modelName,
      fields,
    });
  }

  return models;
}

async function main(): Promise<void> {
  const schemaContents = await readFile(SCHEMA_PATH, 'utf8');
  const models = extractModels(schemaContents);
  const lookup = new Map(models.map((model) => [model.name, model]));

  const manifest = {
    version: '0.1.0',
    generatedAt: new Date().toISOString(),
    source: path.relative(WORKSPACE_ROOT, SCHEMA_PATH),
    datasets: DATASETS.map((dataset) => ({
      name: dataset.name,
      description: dataset.description,
      models: dataset.models
        .map((modelName) => lookup.get(modelName))
        .filter((model): model is ModelDefinition => Boolean(model))
        .map((model) => ({
          name: model.name,
          fields: model.fields.map((field) => ({
            name: field.name,
            type: field.type,
            isList: field.isList,
            attributes: field.attributes,
          })),
        })),
    })),
  };

  await mkdir(ARTIFACT_DIR, { recursive: true });
  await writeFile(ARTIFACT_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Dataset manifest written to ${path.relative(WORKSPACE_ROOT, ARTIFACT_PATH)}`);
}

main().catch((error) => {
  console.error('[model-service] Failed to inspect Prisma schema:', error);
  process.exit(1);
});
