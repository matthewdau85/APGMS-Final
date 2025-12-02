// PAYGW engine calculation coverage against simple ATO-style brackets.
import {
  PaygwEngine,
  type PaygwCalculationInput,
} from "../src/au-tax/paygw-engine";
import {
  TaxType,
  type AuTaxConfig,
  type JurisdictionCode,
  type PaygwBracket,
  type PaygwConfig,
  type TaxParameterSetMeta,
  type TaxConfigRepository,
} from "../src/au-tax/types";

const JURISDICTION_AU: JurisdictionCode = "AU";

const baseMeta: TaxParameterSetMeta = {
  id: "PAYGW_SIMPLE",
  jurisdiction: JURISDICTION_AU,
  taxType: TaxType.PAYGW,
  financialYear: "2024-2025",
  validFrom: new Date("2024-07-01T00:00:00Z"),
  validTo: null,
  description: "Simplified PAYGW brackets for tests",
  versionTag: "v1",
};

// Simplified weekly PAYGW brackets roughly modelled on ATO style:
// - $0 to $359: no withholding
// - $359 to $438: 19% of income above $359
// - $438+: $15.00 plus 29% of income above $438
const simpleBrackets: PaygwBracket[] = [
  { thresholdCents: 0, baseWithholdingCents: 0, marginalRateMilli: 0 },
  { thresholdCents: 359_00, baseWithholdingCents: 0, marginalRateMilli: 190 },
  {
    thresholdCents: 438_00,
    baseWithholdingCents: 15_00,
    marginalRateMilli: 290,
  },
];

class InMemoryTaxConfigRepository implements TaxConfigRepository {
  private readonly config: AuTaxConfig;

  constructor(config: AuTaxConfig) {
    this.config = config;
  }

  async getActiveConfig(): Promise<AuTaxConfig> {
    return this.config;
  }
}

function makeEngine(): PaygwEngine {
  const config: PaygwConfig = {
    meta: baseMeta,
    brackets: simpleBrackets,
    payPeriod: "weekly",
  };
  return new PaygwEngine(new InMemoryTaxConfigRepository(config));
}

function makeInput(
  overrides: Partial<PaygwCalculationInput> = {},
): PaygwCalculationInput {
  return {
    jurisdiction: JURISDICTION_AU,
    paymentDate: new Date("2024-08-01T00:00:00Z"),
    grossCents: 0,
    payPeriod: "weekly",
    ...overrides,
  };
}

describe("PaygwEngine (simplified brackets)", () => {
  it("returns zero withholding for income below the tax-free threshold", async () => {
    const engine = makeEngine();
    const result = await engine.calculate(makeInput({ grossCents: 200_00 }));
    expect(result.withholdingCents).toBe(0);
    expect(result.bracketIndex).toBe(0);
  });

  it("calculates mid-bracket withholding with a 19% marginal rate", async () => {
    const engine = makeEngine();
    const result = await engine.calculate(makeInput({ grossCents: 400_00 }));
    // excess = 400 - 359 = 41; 41 * 19% = 7.79 -> floor to 7.79 -> 779 cents
    expect(result.withholdingCents).toBe(7_79);
    expect(result.bracketIndex).toBe(1);
  });

  it("applies the top bracket base + marginal rate when above the higher threshold", async () => {
    const engine = makeEngine();
    const result = await engine.calculate(
      makeInput({ grossCents: 1_040_00, payPeriod: "fortnightly" }),
    );
    // fortnightly $1,040 -> weekly $520.00
    // weekly excess: 520 - 438 = 82; 82 * 29% = 23.78 -> floor 2378 cents
    // weekly withholding: base $15.00 + 23.78 = $38.78; fortnightly => $77.56
    expect(result.withholdingCents).toBe(77_56);
    expect(result.bracketIndex).toBe(2);
  });
});
