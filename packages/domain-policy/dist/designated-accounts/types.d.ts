export declare enum DesignatedAccountType {
    PAYGW = "PAYGW",
    GST = "GST",
    PAYGI = "PAYGI",
    FBT = "FBT",
    OTHER = "OTHER"
}
export declare enum DesignatedAccountLifecycle {
    PENDING_ACTIVATION = "PENDING_ACTIVATION",
    ACTIVE = "ACTIVE",
    SUNSETTING = "SUNSETTING",
    CLOSED = "CLOSED"
}
/**
 * A designated one-way account is an application-level abstraction.
 * The underlying bank account is managed via providers; this type
 * represents the compliance semantics we must enforce.
 */
export interface DesignatedAccount {
    id: string;
    orgId: string;
    type: DesignatedAccountType;
    lifecycle: DesignatedAccountLifecycle;
    bankingProviderAccountId: string;
    createdAt: Date;
    updatedAt: Date;
}
