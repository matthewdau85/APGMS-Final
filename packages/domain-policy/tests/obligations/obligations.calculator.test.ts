// packages/domain-policy/tests/obligations/obligations.calculator.test.ts

import { computePeriodObligationsFromDtos } from "../../src/obligations/calculator";

describe("computePeriodObligationsFromDtos", () => {
  it("sums PAYGW and GST correctly for simple input", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payrollItems = [
      { orgId: "org-1", period: "2025-Q1", paygwCents: 1_000 },
      { orgId: "org-1", period: "2025-Q1", paygwCents: 2_000 },
    ] as any[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gstTransactions = [
      { orgId: "org-1", period: "2025-Q1", gstCents: 500 },
      { orgId: "org-1", period: "2025-Q1", gstCents: -200 },
    ] as any[];

    const result = computePeriodObligationsFromDtos(payrollItems, gstTransactions);

    expect(result.paygwCents).toBe(3_000);
    expect(result.gstCents).toBe(300);
  });

  it("returns zero obligations when there is no data", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payrollItems = [] as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gstTransactions = [] as any[];

    const result = computePeriodObligationsFromDtos(payrollItems, gstTransactions);

    expect(result.paygwCents).toBe(0);
    expect(result.gstCents).toBe(0);
  });
});
