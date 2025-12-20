declare module "@apgms/domain-policy/risk/anomaly" {
  export type RiskBand = "LOW" | "MEDIUM" | "HIGH" | string;
  export function computeOrgRisk(...args: any[]): any;
}
declare module "@apgms/domain-policy/risk/anomaly.js" {
  export type RiskBand = "LOW" | "MEDIUM" | "HIGH" | string;
  export function computeOrgRisk(...args: any[]): any;
}

declare module "@apgms/domain-policy/ledger/tax-ledger" {
  export function getLedgerBalanceForPeriod(...args: any[]): any;
}
declare module "@apgms/domain-policy/ledger/tax-ledger.js" {
  export function getLedgerBalanceForPeriod(...args: any[]): any;
}

declare module "@apgms/shared/db.js" {
  export const prisma: any;
}
declare module "@apgms/shared/db.js" {
  export const prisma: any;
}
