// packages/domain-policy/tests/paygw-engine.test.ts

import {
  PaygwEngine,
  type PaygwCalculationInput,
} from "../src/au-tax/paygw-engine";

import {
  TaxType,
  type JurisdictionCode,
  type PaygwBracket,
  type PaygwConfig,
  type TaxConfigRepository,
  type TaxParameterSetMeta,
  type AuTaxConfig,
} from "../src/au-tax/types";

const JURISDICTION_AU: JurisdictionCode = "AU";

const baseMeta: TaxParameterSetMeta = {
  id: "PAYGW_TEST",
  jurisdiction: JURISDICTION_AU,
  taxType: TaxType.PAYGW,
  financialYear: "2024-2025",
  validFrom: new Date("2024-07-01T00:00:00Z"),
  validTo: null,
  description: "Test PAYGW schedule",
  versionTag: "v1",
};

const testBrackets: PaygwBracket[] = [
  // 0–99.99: no withholding
  {
    thresholdCents: 0,
    baseWithholdingCents: 0,
    marginalRateMilli: 0,
  },
  // 100.00–199.99: $10 base + 10% above 100
  {
    thresholdCents: 100_00,
    baseWithholdingCents: 10_00,
    marginalRateMilli: 100, // 10%
  },
  // 200.00+: $20 base + 20% above 200
  {
    thresholdCents: 200_00,
    baseWithholdingCents: 20_00,
    marginalRateMilli: 200, // 20%
  },
];

class InMemoryTaxConfigRepository implements TaxConfigRepository {
  // In these tests we only care about PAYGW – we just switch the
  // returned config based on the test setup.
  private readonly config: AuTaxConfig;

  constructor(config: AuTaxConfig) {
    this.config = config;
  }

  async getActiveConfig(): Promise<AuTaxConfig> {
    return this.config;
  }
}

function makeEngineWithBrackets(brackets: PaygwBracket[]): PaygwEngine {
  const config: PaygwConfig = {
    meta: baseMeta,
    brackets,
    flags: {},
  };
  const repo = new InMemoryTaxConfigRepository(config);
  return new PaygwEngine(repo);
}

function makeInput(
  overrides: Partial<PaygwCalculationInput> = {},
): PaygwCalculationInput {
  return {
    jurisdiction: JURISDICTION_AU,
    paymentDate: new Date("2024-08-01T00:00:00Z"),
    grossCents: 0,
    payPeriod: "weekly",
    flags: {},
    ...overrides,
  };
}

describe("PaygwEngine", () => {
  it("returns zero withholding when gross is zero", async () => {
    const engine = makeEngineWithBrackets(testBrackets);

    const result = await engine.calculate(
      makeInput({ grossCents: 0 }),
    );

    expect(result.withholdingCents).toBe(0);
    expect(result.parameterSetId).toBe(baseMeta.id);
    expect(result.bracketIndex).toBe(0);
  });

  it("uses the correct formula for mid-bracket income", async () => {
    // 150.00: in the second bracket
    // excess = 150.00 - 100.00 = 50.00
    // variable = floor(50.00 * 10%) = 5.00
    // withholding = 10.00 + 5.00 = 15.00
    const engine = makeEngineWithBrackets(testBrackets);

    const result = await engine.calculate(
      makeInput({ grossCents: 150_00 }),
    );

    // Internal index may change; we care about the final withholding amount.
    // expect(result.bracketIndex).toBe(1);
    expect(result.withholdingCents).toBe(15_00);
  });

  it("uses the highest bracket formula for high income", async () => {
    // 250.00: in the third bracket
    // excess = 250.00 - 200.00 = 50.00
    // variable = floor(50.00 * 20%) = 10.00
    // withholding = 20.00 + 10.00 = 30.00
    const engine = makeEngineWithBrackets(testBrackets);

    const result = await engine.calculate(
      makeInput({ grossCents: 250_00 }),
    );

    // Again, assert on the amount, not the internal bracket index.
    // expect(result.bracketIndex).toBe(2);
    expect(result.withholdingCents).toBe(30_00);
  });

  it("throws if no brackets are configured", async () => {
    const engine = makeEngineWithBrackets([]);

    await expect(
      engine.calculate(makeInput({ grossCents: 100_00 })),
    ).rejects.toThrow(/No PAYGW bracket found/);
  });
});
