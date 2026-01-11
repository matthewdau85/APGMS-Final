import { registerAllTaxPlugins } from "../plugins/registerAll";
import { computeTax, listTaxTypes } from "../registry";
import type { PaygwInput } from "../plugins/auPaygw";
import type { GstInput } from "../plugins/auGst";

function ensureRegistered() {
  if (!listTaxTypes().includes("AU_PAYGW")) {
    registerAllTaxPlugins();
  }
}

describe("tax config boundaries", () => {
  it("selects pre/post July config for AU_PAYGW", async () => {
    ensureRegistered();
    const baseInput: PaygwInput = {
      payPeriod: "WEEKLY",
      grossIncomeMinor: 10_000_00,
      taxFileNumberProvided: true,
    };

    const oldRes = await computeTax("AU_PAYGW", { asAt: "2025-06-30" }, baseInput);
    const newRes = await computeTax("AU_PAYGW", { asAt: "2025-07-01" }, {
      ...baseInput,
      asAt: "2025-07-01",
    });

    const oldPack = (oldRes[0] as { evidenceRef?: { evidencePackId?: string } }).evidenceRef?.evidencePackId;
    const newPack = (newRes[0] as { evidenceRef?: { evidencePackId?: string } }).evidenceRef?.evidencePackId;
    expect(oldPack).toBe("AU_PAYGW:au-paygw-2025-06:2025-06-30");
    expect(newPack).toBe("AU_PAYGW:au-paygw-2025-07:2025-07-01");
  });

  it("selects pre/post July config for AU_GST", async () => {
    ensureRegistered();
    const baseInput: GstInput = {
      basPeriod: "MONTHLY",
      salesGstMinor: 500_00,
      purchasesGstCreditMinor: 100_00,
    };

    const oldRes = await computeTax("AU_GST", { asAt: "2025-06-30" }, baseInput);
    const newRes = await computeTax("AU_GST", { asAt: "2025-07-01" }, {
      ...baseInput,
      asAt: "2025-07-01",
    });

    const oldPack = (oldRes[0] as { evidenceRef?: { evidencePackId?: string } }).evidenceRef?.evidencePackId;
    const newPack = (newRes[0] as { evidenceRef?: { evidencePackId?: string } }).evidenceRef?.evidencePackId;
    expect(oldPack).toBe("AU_GST:au-gst-2025-06:2025-06-30");
    expect(newPack).toBe("AU_GST:au-gst-2025-07:2025-07-01");
  });
});
