// services/api-gateway/src/types/domain-policy-shims.d.ts

declare module "@apgms/domain-policy/settlement/bas-settlement" {
  export const prepareBasSettlementInstruction: any;
}

declare module "@apgms/domain-policy/settlement/bas-settlement.js" {
  export * from "@apgms/domain-policy/settlement/bas-settlement";
}

declare module "@apgms/domain-policy/ledger/tax-ledger" {
  export const getLedgerBalanceForPeriod: any;
}

declare module "@apgms/domain-policy/ledger/tax-ledger.js" {
  export * from "@apgms/domain-policy/ledger/tax-ledger";
}

declare module "@apgms/domain-policy/risk/anomaly" {
  export const detectRisk: any;
  export const listRiskEvents: any;
}
