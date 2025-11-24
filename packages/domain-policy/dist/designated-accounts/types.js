// packages/domain-policy/src/designated-accounts/types.ts
export var DesignatedAccountType;
(function (DesignatedAccountType) {
    DesignatedAccountType["PAYGW"] = "PAYGW";
    DesignatedAccountType["GST"] = "GST";
    DesignatedAccountType["PAYGI"] = "PAYGI";
    DesignatedAccountType["FBT"] = "FBT";
    DesignatedAccountType["OTHER"] = "OTHER";
})(DesignatedAccountType || (DesignatedAccountType = {}));
export var DesignatedAccountLifecycle;
(function (DesignatedAccountLifecycle) {
    DesignatedAccountLifecycle["PENDING_ACTIVATION"] = "PENDING_ACTIVATION";
    DesignatedAccountLifecycle["ACTIVE"] = "ACTIVE";
    DesignatedAccountLifecycle["SUNSETTING"] = "SUNSETTING";
    DesignatedAccountLifecycle["CLOSED"] = "CLOSED";
})(DesignatedAccountLifecycle || (DesignatedAccountLifecycle = {}));
