// packages/domain-policy/src/obligations/types.ts

export type ObligationSource = "PAYROLL" | "POS" | "MANUAL";

export interface BreakdownEntry {
  source: ObligationSource;
  amountCents: number;
}

export interface PeriodObligations {
  paygwCents: number;
  gstCents: number;
  breakdown?: BreakdownEntry[];
}

// DTOs used inside the pure calculator – these are not Prisma entities.
export interface PayrollItemDTO {
  orgId: string;
  period: string; // e.g. "2025-Q3"
  paygwCents: number;
}

export interface GstTransactionDTO {
  orgId: string;
  period: string; // e.g. "2025-Q3"
  gstCents: number;
}
