import type { BusEnvelope } from "@apgms/shared";
import type { DesignatedAccountType, DesignatedTransferSource } from "@apgms/shared/ledger";

export type ObligationType = "PAYGW" | "GST";

export type ObligationCalculatedPayload = {
  obligationType: ObligationType;
  obligationAmount: number;
  basisAmount: number;
  netOfTax?: number;
  effectiveRate: number;
  sourceSystem: "PAYROLL" | "POS";
  reference: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
  breakdown?: {
    lineItems: Array<{
      reference: string;
      basisAmount: number;
      obligationAmount: number;
      metadata?: Record<string, unknown>;
    }>;
  };
};

export type ObligationEventEnvelope = BusEnvelope<ObligationCalculatedPayload>;

export interface EventPublisher {
  publish<T>(subject: string, envelope: BusEnvelope<T>): Promise<void>;
}

export type DesignatedAccountCreditInput = {
  orgId: string;
  accountType: DesignatedAccountType;
  amount: number;
  source: DesignatedTransferSource;
  actorId: string;
};

export type DesignatedAccountCreditor = <TResult = unknown>(
  input: DesignatedAccountCreditInput,
) => Promise<TResult>;
