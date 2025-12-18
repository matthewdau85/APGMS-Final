import { PaygwEngine } from "../src/au-tax/paygw-engine";

function makeTestEngine() {
  return new PaygwEngine({
    async getActiveConfig() {
      return {
        kind: "PAYGW",
        brackets: [
          { thresholdCents: 0, baseCents: 0, rate: 0 },
          { thresholdCents: 18_200_00, baseCents: 0, rate: 0.19 },
          { thresholdCents: 45_000_00, baseCents: 5_092_00, rate: 0.325 },
        ],
      };
    },
  });
}

describe("PaygwEngine", () => {
  it("returns zero withholding when gross is zero", async () => {
    const engine = makeTestEngine();

    const result = await engine.calculate({
      grossCents: 0,
      payPeriod: "WEEKLY",
      jurisdiction: "AU",
      onDate: new Date(),
    });

    expect(result.withholding.cents).toBe(0);
  });

  it("calculates withholding for mid-bracket income", async () => {
    const engine = makeTestEngine();

    const result = await engine.calculate({
      grossCents: 30_000_00,
      payPeriod: "ANNUAL",
      jurisdiction: "AU",
      onDate: new Date(),
    });

    expect(result.withholding.cents).toBeGreaterThan(0);
  });

  it("throws when no PAYGW config is available", async () => {
    const engine = new PaygwEngine({
      async getActiveConfig() {
        return null;
      },
    });

    await expect(
      engine.calculate({
        grossCents: 100_00,
        payPeriod: "WEEKLY",
        jurisdiction: "AU",
        onDate: new Date(),
      }),
    ).rejects.toThrow(/TAX_CONFIG_MISSING/);
  });
});
