import { runBasOutcomeV1FromContext, auditReplayBasOutcomeV1 } from "../bas-outcome.js";

test("bas outcome computes coverage and risk deterministically", () => {
  const ctx = {
    orgId: "org1",
    period: "2025-Q3",
    obligations: { paygwCents: 600_00, gstCents: 400_00 },
    ledger: { paygwCents: 500_00, gstCents: 400_00 },
  };

  const out = runBasOutcomeV1FromContext(ctx as any, { computedAt: "2025-12-22T00:00:00.000Z" });

  expect(out.metrics.totalDueCents).toBe(1000_00);
  expect(out.metrics.totalHeldCents).toBe(900_00);
  expect(out.metrics.basCoverageRatio).toBeCloseTo(0.9, 6);
  expect(out.metrics.riskBand).toBe("LOW");

  // Audit replay verifies hash integrity.
  auditReplayBasOutcomeV1(out);
});

test("bas outcome shortfall yields MEDIUM at 0.8", () => {
  const ctx = {
    orgId: "org1",
    period: "2025-Q3",
    obligations: { paygwCents: 600_00, gstCents: 400_00 },
    ledger: { paygwCents: 400_00, gstCents: 400_00 },
  };

  const out = runBasOutcomeV1FromContext(ctx as any, { computedAt: "2025-12-22T00:00:00.000Z" });

  expect(out.metrics.basCoverageRatio).toBeCloseTo(0.8, 6);
  expect(out.metrics.riskBand).toBe("MEDIUM");
  auditReplayBasOutcomeV1(out);
});
