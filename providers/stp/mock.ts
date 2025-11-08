import { BaseStpProvider } from "./base.js";
import type { NormalizedStpSummary } from "./types.js";

export type MockStpRun = {
  runId: string;
  periodStart: string | Date;
  periodEnd: string | Date;
  paymentDate: string | Date;
  grossWages: number;
  paygwWithheld: number;
  superAccrued?: number;
  employeeCount?: number;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type MockStpPayload = {
  runs: MockStpRun[];
};

export class MockStpProvider extends BaseStpProvider {
  constructor() {
    super("mock");
  }

  protected normalize(payload: unknown): NormalizedStpSummary[] {
    if (!payload || typeof payload !== "object") {
      return [];
    }

    const data = payload as Partial<MockStpPayload>;
    const runs = Array.isArray(data.runs) ? data.runs : [];

    return runs.map((run, index) => {
      if (!run || typeof run !== "object") {
        throw new Error(`Invalid STP run at index ${index}`);
      }
      if (!run.runId) {
        throw new Error("STP run missing runId");
      }
      const periodStart = toDate(run.periodStart, "periodStart");
      const periodEnd = toDate(run.periodEnd, "periodEnd");
      const paymentDate = toDate(run.paymentDate, "paymentDate");
      const grossWages = Number(run.grossWages ?? 0);
      const paygwWithheld = Number(run.paygwWithheld ?? 0);
      const superAccrued = Number(run.superAccrued ?? 0);
      const employeeCount = Number.isFinite(run.employeeCount)
        ? Number(run.employeeCount)
        : 0;

      return {
        providerRunId: String(run.runId),
        periodStart,
        periodEnd,
        paymentDate,
        grossWages,
        paygwWithheld,
        superAccrued,
        employeeCount,
        source: run.source?.toString() ?? "PAYROLL_CAPTURE",
        metadata: run.metadata,
      } satisfies NormalizedStpSummary;
    });
  }
}

function toDate(value: string | Date | undefined, field: string): Date {
  if (!value) {
    throw new Error(`STP run missing ${field}`);
  }
  if (value instanceof Date) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date for ${field}: ${value}`);
  }
  return parsed;
}
