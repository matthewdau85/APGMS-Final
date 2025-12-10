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

// Optional runtime integration hook for your real bank API.
// If nothing provides this at runtime, we still proceed with PREPARED state.
declare const bankApi:
  | {
      createPayToMandate: (args: {
        orgId: string;
        period: string;
        netPayableCents: number;
      }) => Promise<{ id: string }>;
    }
  | undefined;

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

  // Default mandateRef; can be overridden by bankApi below.
  let mandateRef = `BAS-${orgId}-${period}`;

  // Optional: call bank API for side-effect (mandate creation) and
  // use its ID as the mandateRef if available.
  if (typeof bankApi !== "undefined" && bankApi.createPayToMandate) {
    const mandate = await bankApi.createPayToMandate({
      orgId,
      period,
      netPayableCents,
    });

    if (mandate && mandate.id) {
      mandateRef = mandate.id;
    }
  }

  const record = await prisma.settlementInstruction.create({
    data: {
      orgId,
      period,
      payloadJson: JSON.stringify(payload),
      status: "PREPARED",

      // Create a linked PayToAgreement row now to satisfy the Prisma schema.
      payToAgreement: {
        create: {
          orgId,
          status: "PENDING",

          // REQUIRED by your PayToAgreement model:
          mandateRef,
          maxDebitCents: netPayableCents > 0 ? netPayableCents : 0,

          // REQUIRED relation: TrustAccountCreateNestedOneWithoutPayToAgreementsInput
          // For now we create a dummy trust account; later this can be replaced
          // with real banking details or a connect() to an existing trust account.
          trustAccount: {
            create: {
              orgId,
              bankName: "TBD",
              bsb: "000-000",
              accountNo: "00000000",
              nickname: `Trust for ${orgId}`,
            },
          },
        },
      },
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
