// packages/domain-policy/tests/obligations/calculator.test.ts

import { computePeriodObligationsFromDtos } from "../../src/obligations/calculator";
import type {
  PayrollItemDTO,
  GstTransactionDTO,
} from "../../src/obligations/types";

describe("computePeriodObligationsFromDtos", () => {
  it("sums PAYGW and GST and returns a breakdown", () => {
    const payroll: PayrollItemDTO[] = [
      { orgId: "org-1", period: "2025-Q3", paygwCents: 1000 },
      { orgId: "org-1", period: "2025-Q3", paygwCents: 2000 },
    ];

    const gst: GstTransactionDTO[] = [
      { orgId: "org-1", period: "2025-Q3", gstCents: 500 },
      { orgId: "org-1", period: "2025-Q3", gstCents: 500 },
    ];

    const result = computePeriodObligationsFromDtos(payroll, gst);

    expect(result.paygwCents).toBe(3000);
    expect(result.gstCents).toBe(1000);
    expect(result.breakdown).toEqual([
      { source: "PAYROLL", amountCents: 3000 },
      { source: "POS", amountCents: 1000 },
    ]);
  });

  it("handles empty arrays", () => {
    const result = computePeriodObligationsFromDtos([], []);
    expect(result.paygwCents).toBe(0);
    expect(result.gstCents).toBe(0);
    expect(result.breakdown).toEqual([]);
  });
});
