export const DESIGNATED_ACCOUNT_TYPES = ["PAYGW_BUFFER", "GST_BUFFER"] as const;

export type DesignatedAccountType = (typeof DESIGNATED_ACCOUNT_TYPES)[number];

export const DESIGNATED_TRANSFER_SOURCES = [
  "PAYROLL_CAPTURE",
  "GST_CAPTURE",
  "BAS_ESCROW",
] as const;

export type DesignatedTransferSource =
  (typeof DESIGNATED_TRANSFER_SOURCES)[number];

export type DesignatedAccountPolicyInput = {
  amount: number;
  source: string;
};

export type DesignatedAccountPolicyViolation = {
  code:
    | "designated_withdrawal_attempt"
    | "designated_invalid_amount"
    | "designated_untrusted_source";
  message: string;
  severity: "HIGH" | "MEDIUM";
};

export type DesignatedAccountPolicyResult =
  | { allowed: true }
  | { allowed: false; violation: DesignatedAccountPolicyViolation };

