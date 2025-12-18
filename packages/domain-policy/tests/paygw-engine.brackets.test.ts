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

describe("PaygwEngine (simplified brackets)", () => {
  it("returns zero below tax-free threshold", async () => {
    const engine = makeTestEngine();

    const result = await engine.calculate({
      grossCents: 10_000_00,
      payPeriod: "ANNUAL",
      jurisdiction: "AU",
      onDate: new Date(),
    });

    expect(result.withholding.cents).toBe(0);
  });

  it("applies marginal rate in mid bracket", async () => {
    const engine = makeTestEngine();

    const result = await engine.calculate({
      grossCents: 30_000_00,
      payPeriod: "ANNUAL",
      jurisdiction: "AU",
      onDate: new Date(),
    });

    expect(result.withholding.cents).toBeGreaterThan(0);
  });
});
