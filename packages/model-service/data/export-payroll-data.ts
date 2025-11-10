import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PayrollDataset, PayslipRecord, PayRunRecord, EmployeeRecord } from '../src/types.js';

type DataSource = 'prisma' | 'exports';

interface CliOptions {
  source: DataSource;
  output: string;
  includeSensitive: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');

const DEFAULT_EXPORT_PATH = path.join(
  WORKSPACE_ROOT,
  'packages/model-service/artifacts/payroll-dataset.json',
);

async function loadFromPrisma(includeSensitive: boolean): Promise<PayrollDataset> {
  const prismaModule = (await import('@prisma/client')) as any;
  const PrismaClient = prismaModule?.PrismaClient ?? prismaModule?.default?.PrismaClient;
  if (!PrismaClient) {
    throw new Error('Unable to load PrismaClient from @prisma/client. Run `pnpm db:gen` first.');
  }
  const prisma = new PrismaClient();
  try {
    const [employees, payRuns, payslips] = await Promise.all([
      prisma.employee.findMany({
        select: {
          id: true,
          orgId: true,
          employmentType: true,
          baseRate: true,
          superRate: true,
          status: true,
          createdAt: true,
          fullNameCiphertext: includeSensitive,
          fullNameKid: includeSensitive,
        },
      }),
      prisma.payRun.findMany({
        select: {
          id: true,
          orgId: true,
          periodStart: true,
          periodEnd: true,
          paymentDate: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.payslip.findMany({
        select: {
          id: true,
          payRunId: true,
          employeeId: true,
          grossPay: true,
          paygWithheld: true,
          superAccrued: true,
          createdAt: true,
        },
      }),
    ]);

    const normalizeMoney = (value: unknown): number => {
      if (typeof value === 'number') {
        return value;
      }
      if (typeof value === 'string') {
        return Number(value);
      }
      if (value && typeof (value as { toString: () => string }).toString === 'function') {
        return Number((value as { toString: () => string }).toString());
      }
      throw new TypeError(`Unable to normalize monetary value: ${String(value)}`);
    };

    const normalizeEmployee = (employee: any): EmployeeRecord => ({
      id: employee.id,
      orgId: employee.orgId,
      employmentType: employee.employmentType,
      baseRate: normalizeMoney(employee.baseRate),
      superRate: normalizeMoney(employee.superRate),
      status: employee.status,
      createdAt: employee.createdAt.toISOString(),
    });

    const normalizePayRun = (payRun: any): PayRunRecord => ({
      id: payRun.id,
      orgId: payRun.orgId,
      periodStart: payRun.periodStart.toISOString(),
      periodEnd: payRun.periodEnd.toISOString(),
      paymentDate: payRun.paymentDate.toISOString(),
      status: payRun.status,
      createdAt: payRun.createdAt.toISOString(),
    });

    const normalizePayslip = (payslip: any): PayslipRecord => ({
      id: payslip.id,
      payRunId: payslip.payRunId,
      employeeId: payslip.employeeId,
      grossPay: normalizeMoney(payslip.grossPay),
      paygWithheld: normalizeMoney(payslip.paygWithheld),
      superAccrued: normalizeMoney(payslip.superAccrued),
      createdAt: payslip.createdAt.toISOString(),
    });

    return {
      employees: employees.map(normalizeEmployee),
      payRuns: payRuns.map(normalizePayRun),
      payslips: payslips.map(normalizePayslip),
    } satisfies PayrollDataset;
  } finally {
    await prisma.$disconnect();
  }
}

async function loadFromExports(includeSensitive: boolean): Promise<PayrollDataset> {
  const baseDir = path.join(WORKSPACE_ROOT, 'data/external/payroll');
  const employeePath = path.join(baseDir, 'employees.json');
  const payRunPath = path.join(baseDir, 'payRuns.json');
  const payslipPath = path.join(baseDir, 'payslips.json');

  const [employeeRaw, payRunRaw, payslipRaw] = await Promise.all([
    readFile(employeePath, 'utf8'),
    readFile(payRunPath, 'utf8'),
    readFile(payslipPath, 'utf8'),
  ]);

  const dataset = {
    employees: JSON.parse(employeeRaw),
    payRuns: JSON.parse(payRunRaw),
    payslips: JSON.parse(payslipRaw),
  } as PayrollDataset;

  if (!includeSensitive) {
    dataset.employees = dataset.employees.map((employee) => ({
      ...employee,
      fullNameCiphertext: undefined,
      fullNameKid: undefined,
    }));
  }

  return dataset;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    source: 'prisma',
    output: DEFAULT_EXPORT_PATH,
    includeSensitive: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--source': {
        const value = argv[index + 1];
        if (value !== 'prisma' && value !== 'exports') {
          throw new Error('Invalid value for --source. Expected "prisma" or "exports".');
        }
        options.source = value;
        index += 1;
        break;
      }
      case '--output': {
        options.output = path.resolve(argv[index + 1] ?? DEFAULT_EXPORT_PATH);
        index += 1;
        break;
      }
      case '--include-sensitive': {
        options.includeSensitive = true;
        break;
      }
      case '--help':
      case '-h': {
        console.log(
          `Usage: pnpm --filter @apgms/model-service data:export:payroll -- [options]\n\n` +
            `Options:\n` +
            `  --source <prisma|exports>   Source of data (default: prisma).\n` +
            `  --output <path>            Output file path for the combined dataset.\n` +
            `  --include-sensitive        Include encrypted employee fields if available.\n` +
            `  --help                     Show this help message.\n`,
        );
        process.exit(0);
      }
      default:
        break;
    }
  }

  return options;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    const dataset =
      options.source === 'prisma'
        ? await loadFromPrisma(options.includeSensitive)
        : await loadFromExports(options.includeSensitive);

    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, JSON.stringify(dataset, null, 2), 'utf8');
    console.log(
      `Payroll dataset exported using source=\"${options.source}\" to ${options.output}`,
    );
  } catch (error) {
    console.error('[model-service] Failed to export payroll data:', error);
    process.exit(1);
  }
}

main();
