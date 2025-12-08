// packages/domain-policy/src/settlement/bas-settlement.ts

import { prisma } from "@apgms/shared/db.js";
import { computeOrgObligationsForPeriod } from "../obligations/computeOrgObligationsForPeriod.js";
import { getLedgerBalanceForPeriod } from "../ledger/tax-ledger.js";

export type SettlementStatus = "PREPARED" | "SENT" | "ACK" | "FAILED";

export interface BasSettlementPayload {
  orgId: string;
  period: string;
  totalObligationCents: number;
  totalRemittedCents: number;
  netPayableCents: number;
  obligations: {
    paygwCents: number;
    gstCents: number;
    breakdown?: {
      source: "PAYROLL" | "POS" | "MANUAL";
      amountCents: number;
    }[];
  };
  ledgerTotals: {
    PAYGW?: number;
    GST?: number;
    PENALTY?: number;
    ADJUSTMENT?: number;
  };
}

/**
 * PREPARED state: compute obligations + ledger, persist a settlement
 * instruction with a PayTo-ready payload.
 */
export async function prepareBasSettlementInstruction(
  orgId: string,
  period: string,
) {
  const obligations = await computeOrgObligationsForPeriod(orgId, period);
  const ledgerTotals = await getLedgerBalanceForPeriod(orgId, period);

  const totalObligationCents =
    (obligations.paygwCents ?? 0) + (obligations.gstCents ?? 0);
  const totalRemittedCents = (ledgerTotals.PAYGW ?? 0) + (ledgerTotals.GST ?? 0);
  const netPayableCents = totalObligationCents - totalRemittedCents;

  const payload: BasSettlementPayload = {
    orgId,
    period,
    totalObligationCents,
    totalRemittedCents,
    netPayableCents,
    obligations,
    ledgerTotals,
  };

  const record = await prisma.settlementInstruction.create({
    data: {
      orgId,
      period,
      // Prisma schema currently has payloadJson as String,
      // so store the JSON string here:
      payloadJson: JSON.stringify(payload),
      status: "PREPARED",
      // If you add fields like channel or failureReason later,
      // wire them in here and regenerate Prisma client.
    },
  });

  return record;
}

export async function markBasSettlementSent(id: string) {
  return prisma.settlementInstruction.update({
    where: { id },
    data: {
      status: "SENT",
    },
  });
}

export async function markBasSettlementAck(id: string) {
  return prisma.settlementInstruction.update({
    where: { id },
    data: {
      status: "ACK",
    },
  });
}

export async function markBasSettlementFailed(id: string, _reason: string) {
  // NOTE: SettlementInstruction currently has no failureReason field.
  // You can later add one to the Prisma schema and persist `_reason` here.
  return prisma.settlementInstruction.update({
    where: { id },
    data: {
      status: "FAILED",
    },
  });
}
