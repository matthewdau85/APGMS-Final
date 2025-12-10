// services/api-gateway/test/fixtures/ato-examples.ts
// ATO-aligned PAYGW and GST examples for 2024-25.
// These numbers are illustrative but should be kept consistent with
// whatever seeded TaxParameterSet / TaxRateSchedule you’re using.
export const paygwExamples2024_25 = [
    {
        description: "Weekly, no HELP/STSL, tax-free threshold claimed",
        gross: 1000,
        expectedWithholding: 192,
        parameterSetCode: "PAYGW_2024_25_STANDARD",
    },
    {
        description: "Weekly, with HELP/STSL, tax-free threshold claimed",
        gross: 1000,
        expectedWithholding: 230,
        parameterSetCode: "PAYGW_2024_25_STANDARD_HELP",
    },
];
export const gstExamples2024_25 = [
    {
        description: "Simple taxable supply 1100 including GST (100 GST)",
        taxableAmount: 1100,
        gstIncluded: true,
        expectedNetGst: 100,
        parameterSetCode: "GST_2024_25_STANDARD",
    },
    {
        description: "Mixed supplies, 1000 taxable, 500 GST-free",
        taxableAmount: 1500,
        gstIncluded: false,
        expectedNetGst: 100,
        parameterSetCode: "GST_2024_25_STANDARD",
    },
];
//# sourceMappingURL=ato-examples.js.map