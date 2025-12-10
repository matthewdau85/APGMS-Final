export interface PaygwExample {
    description: string;
    gross: number;
    expectedWithholding: number;
    parameterSetCode: string;
}
export interface GstExample {
    description: string;
    taxableAmount: number;
    gstIncluded: boolean;
    expectedNetGst: number;
    parameterSetCode: string;
}
export declare const paygwExamples2024_25: PaygwExample[];
export declare const gstExamples2024_25: GstExample[];
//# sourceMappingURL=ato-examples.d.ts.map