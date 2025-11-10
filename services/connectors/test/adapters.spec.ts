import assert from "node:assert/strict";
import { test } from "node:test";

import { ingestPayrollRun } from "../src/adapters/payroll.js";
import { ingestPosBatch } from "../src/adapters/pos.js";
import type { EventPublisher, DesignatedAccountCreditor, DesignatedAccountCreditInput } from "../src/types.js";
import type { TaxEngineClient } from "../src/tax-engine.js";

const stubTaxEngine: TaxEngineClient = {
  async calculatePaygw({ taxableIncome }) {
    const withheld = Math.round(taxableIncome * 0.2 * 100) / 100;
    return { withheld, effectiveRate: taxableIncome > 0 ? withheld / taxableIncome : 0 };
  },
  async calculateGst({ amount, rate = 0.1 }) {
    if (amount <= 0 || rate <= 0) {
      return { gstPortion: 0, netOfGst: amount };
    }
    const divisor = 1 + rate;
    const net = amount / divisor;
    const gst = amount - net;
    return {
      gstPortion: Math.round(gst * 100) / 100,
      netOfGst: Math.round(net * 100) / 100,
    };
  },
};

test("payroll adapter emits obligation event and credits PAYGW account", async () => {
  const published: Array<{ subject: string; key: string }> = [];
  const credits: DesignatedAccountCreditInput[] = [];

  const publisher: EventPublisher = {
    async publish(subject, envelope) {
      published.push({ subject, key: envelope.key });
    },
  };

  const designatedAccountCredit: DesignatedAccountCreditor = async (input) => {
    credits.push(input);
    return Promise.resolve({});
  };

  const envelope = await ingestPayrollRun(
    {
      orgId: "org-1",
      payrollRunId: "run-123",
      payPeriod: { start: "2025-01-01", end: "2025-01-15" },
      employees: [
        { employeeId: "emp-1", taxableIncome: 2_000 },
        { employeeId: "emp-2", taxableIncome: 1_200 },
      ],
    },
    {
      taxEngine: stubTaxEngine,
      paygwBrackets: [
        { threshold: 5_000, rate: 0.2, base: 0 },
        { threshold: null, rate: 0.3, base: 50 },
      ],
      publisher,
      designatedAccountCredit,
      actorId: "adapter",
      idFactory: () => "evt-1",
      clock: () => new Date("2025-01-16T00:00:00Z"),
    },
  );

  assert.equal(envelope.payload.obligationType, "PAYGW");
  assert.equal(envelope.payload.obligationAmount, 640);
  assert.equal(envelope.payload.metadata.employeeCount, 2);
  assert.equal(published.length, 1);
  assert.equal(published[0].subject, "apgms.obligation.calculated");
  assert.equal(published[0].key, "org-1:run-123");
  assert.equal(credits.length, 1);
  assert.deepEqual(credits[0], {
    orgId: "org-1",
    accountType: "PAYGW",
    amount: 640,
    source: "PAYROLL_CAPTURE",
    actorId: "adapter",
  });
});

test("pos adapter emits GST obligation and credits GST account", async () => {
  const published: Array<{ subject: string; key: string }> = [];
  const credits: DesignatedAccountCreditInput[] = [];

  const publisher: EventPublisher = {
    async publish(subject, envelope) {
      published.push({ subject, key: envelope.key });
    },
  };

  const designatedAccountCredit: DesignatedAccountCreditor = async (input) => {
    credits.push(input);
    return Promise.resolve({});
  };

  const envelope = await ingestPosBatch(
    {
      orgId: "org-1",
      batchId: "batch-9",
      sales: [
        { saleId: "sale-1", total: 110, classification: "taxable" },
        { saleId: "sale-2", total: 55, classification: "gst_free" },
      ],
    },
    {
      taxEngine: stubTaxEngine,
      publisher,
      designatedAccountCredit,
      actorId: "adapter",
      idFactory: () => "evt-2",
      clock: () => new Date("2025-01-17T00:00:00Z"),
      gstRate: 0.1,
    },
  );

  assert.equal(envelope.payload.obligationType, "GST");
  assert.equal(envelope.payload.obligationAmount, 10);
  assert.equal(envelope.payload.metadata.taxableCount, 1);
  assert.equal(envelope.payload.breakdown?.lineItems.length, 2);
  assert.equal(published.length, 1);
  assert.equal(credits.length, 1);
  assert.deepEqual(credits[0], {
    orgId: "org-1",
    accountType: "GST",
    amount: 10,
    source: "GST_CAPTURE",
    actorId: "adapter",
  });
});
