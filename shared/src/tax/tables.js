export const GST_RATE = 0.1;
export const GST_CLASSIFICATIONS = ["taxable", "gst_free", "input_taxed"];
export const PAYGW_WORKING_HOLIDAY_BRACKETS = [
    { upTo: 45_000, marginalRate: 0.15, base: 0, over: 0 },
    { over: 45_000, upTo: 135_000, marginalRate: 0.3, base: 6_750 },
    { over: 135_000, upTo: 190_000, marginalRate: 0.37, base: 33_750 },
    { over: 190_000, marginalRate: 0.45, base: 54_100 },
];
export const STSL_THRESHOLDS = [
    {
        min: 0,
        max: 67_000,
        repayment: { type: "none" },
    },
    {
        min: 67_001,
        max: 125_000,
        repayment: {
            type: "marginal_over_min",
            centsPerDollar: 0.15,
            base: 0,
            minRef: 67_000,
        },
    },
    {
        min: 125_001,
        max: 179_285,
        repayment: {
            type: "base_plus_marginal",
            base: 6_700,
            centsPerDollar: 0.17,
            minRef: 125_000,
        },
    },
    {
        min: 179_286,
        repayment: {
            type: "percent_of_total_income",
            rate: 0.1,
        },
    },
];
export const NO_TFN_WITHHOLDING = {
    residentRate: 0.47,
    foreignResidentRate: 0.45,
};
export const PAYGW_SCHEDULE1_METADATA = {
    schemaVersion: "apgms.tax.v3",
    effectiveFrom: "2024-07-01",
    formula: "y = a*x − b",
    references: {
        residentWithTft: "Schedule 1 coefficients (Scale 2)",
        residentNoTft: "Schedule 1 coefficients (Scale 1)",
        foreignResident: "Schedule 1 coefficients (Scale 3)",
    },
};
export const PAYGW_SCHEDULE1_COEFFICIENTS = {
    scale1NoTaxFreeThreshold: [
        { weeklyLessThan: 150, a: 0.16, b: 0.16 },
        { weeklyLessThan: 371, a: 0.2117, b: 7.755 },
        { weeklyLessThan: 515, a: 0.189, b: -0.6702 },
        { weeklyLessThan: 932, a: 0.3227, b: 68.2367 },
        { weeklyLessThan: 2_246, a: 0.32, b: 65.7202 },
        { weeklyLessThan: 3_303, a: 0.39, b: 222.951 },
        { weeklyLessThan: null, a: 0.47, b: 487.2587 },
    ],
    scale2WithTaxFreeThreshold: [
        { weeklyLessThan: 361, a: null, b: null },
        { weeklyLessThan: 500, a: 0.16, b: 57.8462 },
        { weeklyLessThan: 625, a: 0.26, b: 107.8462 },
        { weeklyLessThan: 721, a: 0.18, b: 57.8462 },
        { weeklyLessThan: 865, a: 0.189, b: 64.3365 },
        { weeklyLessThan: 1_282, a: 0.3227, b: 180.0385 },
        { weeklyLessThan: 2_596, a: 0.32, b: 176.5769 },
        { weeklyLessThan: 3_653, a: 0.39, b: 358.3077 },
        { weeklyLessThan: null, a: 0.47, b: 650.6154 },
    ],
    scale3ForeignResident: [
        { weeklyLessThan: 2_596, a: 0.3, b: 0.3 },
        { weeklyLessThan: 3_653, a: 0.37, b: 181.7308 },
        { weeklyLessThan: null, a: 0.45, b: 474.0385 },
    ],
};
//# sourceMappingURL=tables.js.map