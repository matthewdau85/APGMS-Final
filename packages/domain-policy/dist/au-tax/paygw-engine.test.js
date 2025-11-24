// packages/domain-policy/src/au-tax/paygw-engine.test.ts
import { PaygwEngine, } from "./paygw-engine";
import { TaxType, } from "./types";
const JURISDICTION_AU = "AU";
const baseMeta = {
    id: "PAYGW_TEST",
    jurisdiction: JURISDICTION_AU,
    taxType: TaxType.PAYGW,
    financialYear: "2024-2025",
    validFrom: new Date("2024-07-01T00:00:00Z"),
    validTo: null,
    description: "Test PAYGW schedule",
    versionTag: "v1",
};
const testBrackets = [
    // 0–99.99: no withholding
    {
        thresholdCents: 0,
        baseWithholdingCents: 0,
        marginalRateMilli: 0,
    },
    // 100.00–199.99: $10 base + 10% above 100
    {
        thresholdCents: 10000,
        baseWithholdingCents: 1000,
        marginalRateMilli: 100, // 10%
    },
    // 200.00+: $20 base + 20% above 200
    {
        thresholdCents: 20000,
        baseWithholdingCents: 2000,
        marginalRateMilli: 200, // 20%
    },
];
class InMemoryTaxConfigRepository {
    constructor(config) {
        this.config = config;
    }
    async getActiveConfig() {
        return this.config;
    }
}
function makeEngineWithBrackets(brackets) {
    const config = {
        meta: baseMeta,
        brackets,
        flags: {},
    };
    const repo = new InMemoryTaxConfigRepository(config);
    return new PaygwEngine(repo);
}
function makeInput(overrides = {}) {
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
        const result = await engine.calculate(makeInput({ grossCents: 0 }));
        expect(result.withholdingCents).toBe(0);
        expect(result.parameterSetId).toBe(baseMeta.id);
        expect(result.bracketIndex).toBe(0);
    });
    it("uses the correct bracket and formula for mid-bracket income", async () => {
        // 150.00: in the second bracket
        // excess = 150.00 - 100.00 = 50.00
        // variable = floor(50.00 * 10%) = 5.00
        // withholding = 10.00 + 5.00 = 15.00
        const engine = makeEngineWithBrackets(testBrackets);
        const result = await engine.calculate(makeInput({ grossCents: 15000 }));
        expect(result.bracketIndex).toBe(1);
        expect(result.withholdingCents).toBe(1500);
    });
    it("uses the highest bracket and formula for high income", async () => {
        // 250.00: in the third bracket
        // excess = 250.00 - 200.00 = 50.00
        // variable = floor(50.00 * 20%) = 10.00
        // withholding = 20.00 + 10.00 = 30.00
        const engine = makeEngineWithBrackets(testBrackets);
        const result = await engine.calculate(makeInput({ grossCents: 25000 }));
        expect(result.bracketIndex).toBe(2);
        expect(result.withholdingCents).toBe(3000);
    });
    it("throws if no brackets are configured", async () => {
        const engine = makeEngineWithBrackets([]);
        await expect(engine.calculate(makeInput({ grossCents: 10000 }))).rejects.toThrow(/No PAYGW bracket found/);
    });
});
