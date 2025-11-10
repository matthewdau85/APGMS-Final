import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  NormalizationStats,
  PayrollDataset,
  PayrollFeatureRecord,
  PipelineMetadata,
} from '../types.js';

const FEATURE_DESCRIPTIONS: Array<PipelineMetadata['featureSchema'][number]> = [
  { name: 'employeeId', type: 'string', description: 'Foreign key referencing the employee record.' },
  { name: 'payRunId', type: 'string', description: 'Identifier for the pay run containing the payslip.' },
  { name: 'periodStart', type: 'string', description: 'ISO-8601 timestamp for the start of the pay period.' },
  { name: 'periodEnd', type: 'string', description: 'ISO-8601 timestamp for the end of the pay period.' },
  { name: 'paymentDate', type: 'string', description: 'ISO-8601 timestamp when the payslip was scheduled for payment.' },
  { name: 'grossPay', type: 'number', description: 'Total gross pay for the payslip in AUD.' },
  { name: 'paygWithheld', type: 'number', description: 'Total PAYG withheld amount in AUD.' },
  { name: 'superAccrued', type: 'number', description: 'Total superannuation accrued in AUD.' },
  { name: 'netPay', type: 'number', description: 'Computed net pay in AUD after PAYG withholding.' },
  { name: 'payPeriodDays', type: 'number', description: 'Duration of the pay period in days.' },
  { name: 'grossPerDay', type: 'number', description: 'Average gross pay per day across the period.' },
];

export interface PayrollPipelineOptions {
  inputPath: string;
  outputDir: string;
  version?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');

function readJsonFile<T>(filePath: string): Promise<T> {
  return readFile(filePath, 'utf8').then((raw) => JSON.parse(raw) as T);
}

function ensureNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  if (value && typeof (value as { toString: () => string }).toString === 'function') {
    const parsed = Number((value as { toString: () => string }).toString());
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  throw new TypeError(`Unable to coerce value \"${String(value)}\" to number.`);
}

function diffInDays(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / msPerDay));
}

function computeFeatures(dataset: PayrollDataset): PayrollFeatureRecord[] {
  const payRunIndex = new Map(dataset.payRuns.map((payRun) => [payRun.id, payRun]));
  return dataset.payslips
    .map((payslip) => {
      const payRun = payRunIndex.get(payslip.payRunId);
      if (!payRun) {
        return null;
      }

      const grossPay = ensureNumber(payslip.grossPay);
      const withheld = ensureNumber(payslip.paygWithheld);
      const superAccrued = ensureNumber(payslip.superAccrued);
      const netPay = grossPay - withheld;
      const periodDays = diffInDays(payRun.periodStart, payRun.periodEnd);

      return {
        employeeId: payslip.employeeId,
        payRunId: payslip.payRunId,
        periodStart: payRun.periodStart,
        periodEnd: payRun.periodEnd,
        paymentDate: payRun.paymentDate,
        grossPay,
        paygWithheld: withheld,
        superAccrued,
        netPay,
        payPeriodDays: periodDays,
        grossPerDay: periodDays === 0 ? grossPay : grossPay / periodDays,
      } satisfies PayrollFeatureRecord;
    })
    .filter((record): record is PayrollFeatureRecord => Boolean(record));
}

function computeNormalization(records: PayrollFeatureRecord[]): NormalizationStats[] {
  const numericFields: Array<keyof PayrollFeatureRecord> = [
    'grossPay',
    'paygWithheld',
    'superAccrued',
    'netPay',
    'payPeriodDays',
    'grossPerDay',
  ];

  return numericFields.map((field) => {
    const values = records.map((record) => record[field] as number);
    const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
    const variance =
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(values.length, 1);
    const stdDev = Math.sqrt(variance) || 1;
    const min = values.length === 0 ? 0 : Math.min(...values);
    const max = values.length === 0 ? 0 : Math.max(...values);

    return {
      field,
      mean,
      stdDev,
      min,
      max,
    } satisfies NormalizationStats;
  });
}

function normalizeRecords(
  records: PayrollFeatureRecord[],
  stats: NormalizationStats[],
): PayrollFeatureRecord[] {
  const lookup = new Map(stats.map((stat) => [stat.field, stat]));
  return records.map((record) => {
    const cloned: PayrollFeatureRecord = { ...record };
    lookup.forEach((stat, field) => {
      const value = record[field];
      if (typeof value === 'number') {
        const normalized = (value - stat.mean) / stat.stdDev;
        const typedField = field as keyof PayrollFeatureRecord;
        (cloned as Record<keyof PayrollFeatureRecord, PayrollFeatureRecord[keyof PayrollFeatureRecord]>)[
          typedField
        ] = normalized as PayrollFeatureRecord[keyof PayrollFeatureRecord];
      }
    });
    return cloned;
  });
}

function toCsv(records: PayrollFeatureRecord[]): string {
  const headers = [
    'employeeId',
    'payRunId',
    'periodStart',
    'periodEnd',
    'paymentDate',
    'grossPay',
    'paygWithheld',
    'superAccrued',
    'netPay',
    'payPeriodDays',
    'grossPerDay',
  ];

  const lines = [headers.join(',')];
  for (const record of records) {
    lines.push(
      headers
        .map((header) => {
          const value = record[header as keyof PayrollFeatureRecord];
          if (typeof value === 'number') {
            return value.toFixed(6);
          }
          return `"${String(value)}"`;
        })
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

export async function runPayrollFeaturePipeline({
  inputPath,
  outputDir,
  version = '0.1.0',
}: PayrollPipelineOptions): Promise<void> {
  const absoluteInput = path.resolve(inputPath);
  const dataset = await readJsonFile<PayrollDataset>(absoluteInput);
  const features = computeFeatures(dataset);
  const normalization = computeNormalization(features);
  const normalizedRecords = normalizeRecords(features, normalization);

  const normalizedCsv = toCsv(normalizedRecords);
  const rawCsv = toCsv(features);

  await mkdir(outputDir, { recursive: true });

  const rawOutputPath = path.join(outputDir, 'payroll_features.raw.csv');
  const normalizedOutputPath = path.join(outputDir, 'payroll_features.normalized.csv');
  const metadataPath = path.join(outputDir, 'payroll_features.metadata.json');
  const schemaArtifactPath = path.join(
    WORKSPACE_ROOT,
    'packages/model-service/artifacts/payroll_feature_schema.json',
  );

  const metadata: PipelineMetadata = {
    version,
    generatedAt: new Date().toISOString(),
    sourceDataset: absoluteInput,
    recordCount: features.length,
    featureSchema: FEATURE_DESCRIPTIONS,
    normalization,
  };

  await Promise.all([
    writeFile(rawOutputPath, rawCsv, 'utf8'),
    writeFile(normalizedOutputPath, normalizedCsv, 'utf8'),
    writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8'),
    writeFile(schemaArtifactPath, JSON.stringify({
      version,
      updatedAt: new Date().toISOString(),
      fields: FEATURE_DESCRIPTIONS,
    }, null, 2), 'utf8'),
  ]);
}
