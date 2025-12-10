export declare const DESIGNATED_ACCOUNT_TYPES: readonly ["PAYGW", "GST"];
export type DesignatedAccountType = (typeof DESIGNATED_ACCOUNT_TYPES)[number];
export declare const DESIGNATED_TRANSFER_SOURCES: readonly ["PAYROLL_CAPTURE", "GST_CAPTURE", "BAS_ESCROW"];
export type DesignatedTransferSource = (typeof DESIGNATED_TRANSFER_SOURCES)[number];
export type DesignatedAccountPolicyInput = {
    amount: number;
    source: string;
};
export type DesignatedAccountPolicyViolation = {
    code: "designated_withdrawal_attempt" | "designated_invalid_amount" | "designated_untrusted_source";
    message: string;
    severity: "HIGH" | "MEDIUM";
};
export type DesignatedAccountPolicyResult = {
    allowed: true;
} | {
    allowed: false;
    violation: DesignatedAccountPolicyViolation;
};
//# sourceMappingURL=types.d.ts.map