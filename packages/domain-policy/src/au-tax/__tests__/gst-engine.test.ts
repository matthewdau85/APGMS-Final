// packages/domain-policy/src/au-tax/__tests__/gst-engine.test.ts

import { GstEngine } from "../gst-engine.js";
import { TaxType } from "../types.js";

const config = {
  kind: "GST",
  jurisdiction: "AU",
  taxType: TaxType.GST,
  rateMilli: 100, // 10%
  classificationMap: {
    general_goods: "taxable",
    food_basic: "gst_free",
    exports: "gst_free",
    financial_supplies: "input_taxed",
  },
} as any;

describe("GstEngine", () => {
  it("calculates net GST for taxable sales", async () => {
    const engine = new GstEngine({
      getActiveConfig: async (_j: any, taxType: any) => (taxType === TaxType.GST ? config : null),
    } as any);

    const result = await engine.calculate({
      orgId: "org",
      jurisdiction: "AU",
      asOf: new Date("2025-01-01T00:00:00Z"),
      salesLines: [{ category: "general_goods", amountCents: 1000 }],
    });

    expect(result.gstOnSalesCents).toBe(100);
    expect(result.netGstCents).toBe(100);
  });

  it("treats GST-free sales as zero GST", async () => {
    const engine = new GstEngine({
      getActiveConfig: async () => config,
    } as any);

    const result = await engine.calculate({
      orgId: "org",
      jurisdiction: "AU",
      asOf: new Date("2025-01-01T00:00:00Z"),
      salesLines: [{ category: "food_basic", amountCents: 1000 }],
    });

    expect(result.gstOnSalesCents).toBe(0);
    expect(result.netGstCents).toBe(0);
  });

  it("treats input-taxed sales as zero GST", async () => {
    const engine = new GstEngine({
      getActiveConfig: async () => config,
    } as any);

    const result = await engine.calculate({
      orgId: "org",
      jurisdiction: "AU",
      asOf: new Date("2025-01-01T00:00:00Z"),
      salesLines: [{ category: "financial_supplies", amountCents: 1000 }],
    });

    expect(result.gstOnSalesCents).toBe(0);
    expect(result.netGstCents).toBe(0);
  });

  it("reduces net GST by taxable purchases (input tax credits)", async () => {
    const engine = new GstEngine({
      getActiveConfig: async () => config,
    } as any);

    const result = await engine.calculate({
      orgId: "org",
      jurisdiction: "AU",
      asOf: new Date("2025-01-01T00:00:00Z"),
      salesLines: [{ category: "general_goods", amountCents: 1000 }],
      purchaseLines: [{ category: "general_goods", amountCents: 500 }],
    });

    expect(result.netGstCents).toBe(50); // 100 - 50
  });

  it("applies adjustments that reduce net", async () => {
    const engine = new GstEngine({
      getActiveConfig: async () => config,
    } as any);

    const result = await engine.calculate({
      orgId: "org",
      jurisdiction: "AU",
      asOf: new Date("2025-01-01T00:00:00Z"),
      salesLines: [{ category: "general_goods", amountCents: 1000 }],
      adjustments: [{ category: "general_goods", amountCents: -200 }],
    });

    expect(result.netGstCents).toBe(80); // 100 + (-20)
  });
});
