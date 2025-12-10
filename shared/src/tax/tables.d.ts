export declare const GST_RATE = 0.1;
export declare const GST_CLASSIFICATIONS: readonly ["taxable", "gst_free", "input_taxed"];
export declare const PAYGW_WORKING_HOLIDAY_BRACKETS: readonly [{
    readonly upTo: 45000;
    readonly marginalRate: 0.15;
    readonly base: 0;
    readonly over: 0;
}, {
    readonly over: 45000;
    readonly upTo: 135000;
    readonly marginalRate: 0.3;
    readonly base: 6750;
}, {
    readonly over: 135000;
    readonly upTo: 190000;
    readonly marginalRate: 0.37;
    readonly base: 33750;
}, {
    readonly over: 190000;
    readonly marginalRate: 0.45;
    readonly base: 54100;
}];
export declare const STSL_THRESHOLDS: readonly [{
    readonly min: 0;
    readonly max: 67000;
    readonly repayment: {
        readonly type: "none";
    };
}, {
    readonly min: 67001;
    readonly max: 125000;
    readonly repayment: {
        readonly type: "marginal_over_min";
        readonly centsPerDollar: 0.15;
        readonly base: 0;
        readonly minRef: 67000;
    };
}, {
    readonly min: 125001;
    readonly max: 179285;
    readonly repayment: {
        readonly type: "base_plus_marginal";
        readonly base: 6700;
        readonly centsPerDollar: 0.17;
        readonly minRef: 125000;
    };
}, {
    readonly min: 179286;
    readonly repayment: {
        readonly type: "percent_of_total_income";
        readonly rate: 0.1;
    };
}];
export declare const NO_TFN_WITHHOLDING: {
    readonly residentRate: 0.47;
    readonly foreignResidentRate: 0.45;
};
export declare const PAYGW_SCHEDULE1_METADATA: {
    readonly schemaVersion: "apgms.tax.v3";
    readonly effectiveFrom: "2024-07-01";
    readonly formula: "y = a*x − b";
    readonly references: {
        readonly residentWithTft: "Schedule 1 coefficients (Scale 2)";
        readonly residentNoTft: "Schedule 1 coefficients (Scale 1)";
        readonly foreignResident: "Schedule 1 coefficients (Scale 3)";
    };
};
export declare const PAYGW_SCHEDULE1_COEFFICIENTS: {
    readonly scale1NoTaxFreeThreshold: readonly [{
        readonly weeklyLessThan: 150;
        readonly a: 0.16;
        readonly b: 0.16;
    }, {
        readonly weeklyLessThan: 371;
        readonly a: 0.2117;
        readonly b: 7.755;
    }, {
        readonly weeklyLessThan: 515;
        readonly a: 0.189;
        readonly b: -0.6702;
    }, {
        readonly weeklyLessThan: 932;
        readonly a: 0.3227;
        readonly b: 68.2367;
    }, {
        readonly weeklyLessThan: 2246;
        readonly a: 0.32;
        readonly b: 65.7202;
    }, {
        readonly weeklyLessThan: 3303;
        readonly a: 0.39;
        readonly b: 222.951;
    }, {
        readonly weeklyLessThan: null;
        readonly a: 0.47;
        readonly b: 487.2587;
    }];
    readonly scale2WithTaxFreeThreshold: readonly [{
        readonly weeklyLessThan: 361;
        readonly a: null;
        readonly b: null;
    }, {
        readonly weeklyLessThan: 500;
        readonly a: 0.16;
        readonly b: 57.8462;
    }, {
        readonly weeklyLessThan: 625;
        readonly a: 0.26;
        readonly b: 107.8462;
    }, {
        readonly weeklyLessThan: 721;
        readonly a: 0.18;
        readonly b: 57.8462;
    }, {
        readonly weeklyLessThan: 865;
        readonly a: 0.189;
        readonly b: 64.3365;
    }, {
        readonly weeklyLessThan: 1282;
        readonly a: 0.3227;
        readonly b: 180.0385;
    }, {
        readonly weeklyLessThan: 2596;
        readonly a: 0.32;
        readonly b: 176.5769;
    }, {
        readonly weeklyLessThan: 3653;
        readonly a: 0.39;
        readonly b: 358.3077;
    }, {
        readonly weeklyLessThan: null;
        readonly a: 0.47;
        readonly b: 650.6154;
    }];
    readonly scale3ForeignResident: readonly [{
        readonly weeklyLessThan: 2596;
        readonly a: 0.3;
        readonly b: 0.3;
    }, {
        readonly weeklyLessThan: 3653;
        readonly a: 0.37;
        readonly b: 181.7308;
    }, {
        readonly weeklyLessThan: null;
        readonly a: 0.45;
        readonly b: 474.0385;
    }];
};
//# sourceMappingURL=tables.d.ts.map