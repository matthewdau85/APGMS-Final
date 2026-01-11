import { auPaygwPlugin, type PaygwInput } from "../plugins/auPaygw";

describe("auPaygwPlugin", () => {
  it("uses the correct effective parameter set at boundaries", async () => {
    const baseInput = {
      payPeriod: "WEEKLY" as const,
      grossIncomeMinor: 10_000_00,
      taxFileNumberProvided: true,
    };

    const oldResult = await auPaygwPlugin.compute(
      { asAt: "2025-06-30" },
      { ...baseInput, asAt: "2025-06-30" }
    );
    const newResult = await auPaygwPlugin.compute(
      { asAt: "2025-07-01" },
      { ...baseInput, asAt: "2025-07-01" }
    );

    expect(oldResult[0].amountCents).not.toBe(newResult[0].amountCents);
  });

  it("rejects non-uppercase pay periods", async () => {
    const badPeriod = "weekly" as PaygwInput["payPeriod"];
    await expect(
      auPaygwPlugin.compute(
        { asAt: "2025-07-01" },
        {
          payPeriod: badPeriod,
          grossIncomeMinor: 10_000_00,
          taxFileNumberProvided: true,
          asAt: "2025-07-01",
        }
      )
    ).rejects.toThrow();
  });
});
