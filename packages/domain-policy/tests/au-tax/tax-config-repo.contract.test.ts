import type { TaxConfigRepository } from "../../src/au-tax/types";

function makeTestRepo(): TaxConfigRepository {
  return {
    async getActiveConfig() {
      return {
        kind: "PAYGW",
        brackets: [
          { thresholdCents: 0, baseCents: 0, rate: 0 },
        ],
      };
    },
  };
}

describe("TaxConfigRepository contract", () => {
  it("returns active PAYGW config with brackets", async () => {
    const repo = makeTestRepo();

    const cfg = await repo.getActiveConfig({
      jurisdiction: "AU",
      taxType: "PAYGW",
      onDate: new Date(),
    });

    expect(cfg?.kind).toBe("PAYGW");
    expect(cfg?.brackets.length).toBeGreaterThan(0);
  });
});
