// packages/domain-policy/tests/obligations/obligations.calculator.test.ts

import { computePeriodObligationsFromDtos } from "../../src/obligations/calculator";

describe("computePeriodObligationsFromDtos", () => {
  it("sums PAYGW and GST correctly for simple input", () => {
    const result = computePeriodObligationsFromDtos({
      // We deliberately pass partial DTOs and cast to any for test simplicity
      // so we don't depend on the full DTO shape here.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payrollItems: [
        { orgId: "org-1", period: "2025-Q1", paygwCents: 1_000 },
        { orgId: "org-1", period: "2025-Q1", paygwCents: 2_000 },
      ] as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gstTransactions: [
        { orgId: "org-1", period: "2025-Q1", gstCents: 500 },
        { orgId: "org-1", period: "2025-Q1", gstCents: -200 },
      ] as any[],
    });

    expect(result.paygwCents).toBe(3_000);
    expect(result.gstCents).toBe(300);
  });

  it("returns zero obligations when there is no data", () => {
    const result = computePeriodObligationsFromDtos({
      payrollItems: [] as any[],
      gstTransactions: [] as any[],
    });

    expect(result.paygwCents).toBe(0);
    expect(result.gstCents).toBe(0);
  });
});
