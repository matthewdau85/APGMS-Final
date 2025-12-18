import { PaygwEngine } from "../../src/au-tax/paygw-engine";

export function makeTestPaygwEngine() {
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
