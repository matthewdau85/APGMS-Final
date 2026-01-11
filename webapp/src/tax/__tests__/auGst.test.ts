import { auGstPlugin, type GstInput } from "../plugins/auGst";

describe("auGstPlugin", () => {
  it("calculates net GST and clamps at zero", async () => {
    const input: GstInput = {
      basPeriod: "MONTHLY",
      salesGstMinor: 500_00,
      purchasesGstCreditMinor: 200_00,
      asAt: "2025-07-15",
    };
    const res = await auGstPlugin.compute({ asAt: "2025-07-15" }, input);
    expect(res[0].amountCents).toBe(300_00);

    const refundInput: GstInput = {
      basPeriod: "MONTHLY",
      salesGstMinor: 100_00,
      purchasesGstCreditMinor: 200_00,
      asAt: "2025-07-15",
    };
    const refundRes = await auGstPlugin.compute({ asAt: "2025-07-15" }, refundInput);
    expect(refundRes[0].amountCents).toBe(0);
  });

  it("uses the correct effective parameter set at boundaries", async () => {
    const baseInput: GstInput = {
      basPeriod: "QUARTERLY",
      salesGstMinor: 1_000_00,
      purchasesGstCreditMinor: 0,
      asAt: "2025-06-30",
    };

    const oldResult = await auGstPlugin.compute(
      { asAt: "2025-06-30" },
      { ...baseInput, asAt: "2025-06-30" }
    );
    const newResult = await auGstPlugin.compute(
      { asAt: "2025-07-01" },
      { ...baseInput, asAt: "2025-07-01" }
    );

    const oldPack = (oldResult[0] as { evidenceRef?: { evidencePackId?: string } }).evidenceRef?.evidencePackId;
    const newPack = (newResult[0] as { evidenceRef?: { evidencePackId?: string } }).evidenceRef?.evidencePackId;
    expect(oldPack).toBe("AU_GST:au-gst-2025-06:2025-06-30");
    expect(newPack).toBe("AU_GST:au-gst-2025-07:2025-07-01");
  });
});
