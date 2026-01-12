import { GstEngine } from "../gst-engine.ts";
import type { GstConfig, TaxConfigRepository } from "../types.js";
import { TaxType } from "../types.js";

const config: GstConfig = {
  kind: "GST",
  jurisdiction: "AU",
  taxType: TaxType.GST,
  rateMilli: 100,
  classificationMap: {
    general_goods: "taxable",
    food_basic: "gst_free",
    exports: "input_taxed",
  },
};

const repo: TaxConfigRepository = {
  async getActiveConfig() {
    return config;
  },
};

const engine = new GstEngine(repo);

describe("GST engine classification netting", () => {
  it("reports net payable for taxable sales/purchases", async () => {
    const result = await engine.calculate({
      orgId: "org",
      jurisdiction: "AU",
      asOf: new Date(),
      salesLines: [{ category: "general_goods", amountCents: 1000 }],
      purchaseLines: [{ category: "general_goods", amountCents: 200 }],
    });
    expect(result.netGstCents).toBe(80);
    expect(result.isRefundDue).toBe(false);
  });

  it("supports refunds (negative net)", async () => {
    const result = await engine.calculate({
      orgId: "org",
      jurisdiction: "AU",
      asOf: new Date(),
      salesLines: [{ category: "general_goods", amountCents: 1000 }],
      purchaseLines: [{ category: "general_goods", amountCents: 2000 }],
    });
    expect(result.netGstCents).toBeLessThan(0);
    expect(result.isRefundDue).toBe(true);
  });

  it("is zero for gst-free supplies", async () => {
    const result = await engine.calculate({
      orgId: "org",
      jurisdiction: "AU",
      asOf: new Date(),
      salesLines: [{ category: "food_basic", amountCents: 1000 }],
    });
    expect(result.gstOnSalesCents).toBe(0);
    expect(result.netGstCents).toBe(0);
  });

  it("ignores input-taxed amounts when not flagged for credits", async () => {
    const result = await engine.calculate({
      orgId: "org",
      jurisdiction: "AU",
      asOf: new Date(),
      salesLines: [{ category: "exports", amountCents: 1000 }],
    });
    expect(result.netGstCents).toBe(0);
  });

  it("applies adjustments that reduce net", async () => {
    const result = await engine.calculate({
      orgId: "org",
      jurisdiction: "AU",
      asOf: new Date(),
      salesLines: [{ category: "general_goods", amountCents: 1000 }],
      adjustments: [{ category: "general_goods", amountCents: -200 }],
    });
    expect(result.netGstCents).toBe(80); // 100 + (-20)
  });
});
