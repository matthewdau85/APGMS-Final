import { PrismaClient } from '@prisma/client';
import { getLedgerBalanceForPeriod } from '../ledger/tax-ledger';

const prisma = new PrismaClient();

export interface BasSettlementInstruction {
  orgId: string;
  period: string;
  paygwCents: number;
  gstCents: number;
  totalDebitCents: number;
  trustAccount: {
    bankName: string;
    bsb: string;
    accountNoMasked: string;
  };
  payToMandateRef: string;
  createdAt: string;
}

export async function prepareBasSettlementInstruction(orgId: string, period: string) {
  const ledgerTotals = await getLedgerBalanceForPeriod(orgId, period);

  const payTo = await prisma.payToAgreement.findFirst({
    where: { orgId, status: 'ACTIVE' },
    include: { TrustAccount: true },
  });

  if (!payTo) {
    throw new Error('NO_ACTIVE_PAYTO_MANDATE');
  }

  const payload: BasSettlementInstruction = {
    orgId,
    period,
    paygwCents: ledgerTotals.PAYGW,
    gstCents: ledgerTotals.GST,
    totalDebitCents: ledgerTotals.PAYGW + ledgerTotals.GST,
    trustAccount: {
      bankName: payTo.TrustAccount.bankName,
      bsb: payTo.TrustAccount.bsb,
      accountNoMasked:
        'XXXXXX' + payTo.TrustAccount.accountNo.slice(-4),
    },
    payToMandateRef: payTo.mandateRef,
    createdAt: new Date().toISOString(),
  };

  const record = await prisma.settlementInstruction.create({
    data: {
      orgId,
      period,
      payToAgreementId: payTo.id,
      payloadJson: JSON.stringify(payload),
      status: 'PREPARED',
    },
  });

  return { payload, record };
}
