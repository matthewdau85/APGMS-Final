test("DB-only tests are gated by RUN_DB_TESTS", () => {
  // Prevents Jest from erroring when this file conditionally defines tests.
  expect(true).toBe(true);
});

const runDb = process.env.RUN_DB_TESTS === "1";

(runDb ? describe : describe.skip)(
  "TaxLedger hash-chain integrity (db)",
  () => {
    const { prisma } = require("@apgms/shared/db");
    const {
      appendLedgerEntry,
      verifyLedgerChain,
    } = require("../../src/ledger/tax-ledger");

    const orgId = "org-test";
    const period = "2025-Q1";

    beforeAll(async () => {
      await prisma.taxLedgerEntry.deleteMany({ where: { orgId, period } });
    });

    afterAll(async () => {
      await prisma.taxLedgerEntry.deleteMany({ where: { orgId, period } });
    });

    it("returns ok=true for a normal, untampered chain", async () => {
      await appendLedgerEntry({
        orgId,
        period,
        category: "PAYGW",
        direction: "CREDIT",
        amountCents: 100_00,
        description: "Initial entry",
      });

      await appendLedgerEntry({
        orgId,
        period,
        category: "PAYGW",
        direction: "CREDIT",
        amountCents: 200_00,
        description: "Second entry",
      });

      const result = await verifyLedgerChain(orgId, period);

      expect(result.ok).toBe(true);
      expect(result.firstInvalidIndex).toBeUndefined();
      expect(result.reason).toBeUndefined();
    });
  },
);
