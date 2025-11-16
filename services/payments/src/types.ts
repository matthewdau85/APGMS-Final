export type Bank = 'CBA' | 'NAB' | 'ANZ';

export type Obligation = 'PAYGW' | 'GST' | 'PAYGI';

export type MandateStatus = 'PENDING' | 'AUTHORIZED' | 'ACTIVE';

export interface PayToMandate {
  id: string;
  accountId: string;
  bank: Bank;
  status: MandateStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, string>;
}

export interface DesignatedAccount {
  id: string;
  orgId: string;
  bank: Bank;
  bsb: string;
  accountNumber: string;
  obligation: Obligation;
  depositOnly: boolean;
  payToMandateId?: string;
  payToStatus?: MandateStatus;
  metadata?: Record<string, string>;
}

export interface CreateDesignatedAccountInput {
  orgId: string;
  bank: Bank;
  bsb: string;
  accountNumber: string;
  obligation: Obligation;
  depositOnly?: boolean;
  metadata?: Record<string, string>;
}

export type TransferDirection = 'DEPOSIT' | 'WITHDRAW';

export interface TransferReceipt {
  status: 'SETTLED' | 'BLOCKED';
  amount: number;
  direction: TransferDirection;
  reference?: string;
  reason?: string;
}
