import { randomUUID } from 'node:crypto';
import type {
  Bank,
  DesignatedAccount,
  PayToMandate,
  TransferDirection,
  TransferReceipt,
} from './types.ts';

export interface BankProvider {
  bank: Bank;
  enforceDepositOnly: boolean;
  createMandate(account: DesignatedAccount): PayToMandate;
  authorizeMandate(mandateId: string): PayToMandate;
  verifyMandate(mandateId: string): boolean;
  transfer(
    account: DesignatedAccount,
    amount: number,
    direction: TransferDirection,
  ): TransferReceipt;
}

export interface PayToService {
  createMandate(account: DesignatedAccount): Promise<PayToMandate>;
  authorizeMandate(mandateId: string): Promise<PayToMandate>;
  verifyMandate(mandateId: string): Promise<boolean>;
  requiresDepositOnly(bank: Bank): boolean;
  transfer(
    account: DesignatedAccount,
    amount: number,
    direction: TransferDirection,
  ): Promise<TransferReceipt>;
}

class MandateNotFoundError extends Error {
  constructor(mandateId: string) {
    super(`Mandate ${mandateId} was not found`);
  }
}

export class MockBankProvider implements BankProvider {
  private mandates = new Map<string, PayToMandate>();

  constructor(
    public readonly bank: Bank,
    public readonly enforceDepositOnly: boolean = false,
  ) {}

  createMandate(account: DesignatedAccount): PayToMandate {
    const now = new Date();
    const mandate: PayToMandate = {
      id: randomUUID(),
      accountId: account.id,
      bank: this.bank,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
      metadata: account.metadata,
    };
    this.mandates.set(mandate.id, mandate);
    return { ...mandate };
  }

  authorizeMandate(mandateId: string): PayToMandate {
    const mandate = this.requireMandate(mandateId);
    mandate.status = 'AUTHORIZED';
    mandate.updatedAt = new Date();
    return { ...mandate };
  }

  verifyMandate(mandateId: string): boolean {
    const mandate = this.requireMandate(mandateId);
    mandate.status = 'ACTIVE';
    mandate.updatedAt = new Date();
    return true;
  }

  transfer(
    account: DesignatedAccount,
    amount: number,
    direction: TransferDirection,
  ): TransferReceipt {
    if (direction === 'WITHDRAW' && this.enforceDepositOnly) {
      throw new Error(`${this.bank} designated accounts are deposit-only.`);
    }
    if (account.payToStatus !== 'ACTIVE') {
      throw new Error(
        `PayTo mandate ${account.payToMandateId ?? 'unknown'} is not active.`,
      );
    }
    return {
      status: 'SETTLED',
      amount,
      direction,
      reference: `${this.bank}-${account.id}-${Date.now()}`,
    };
  }

  private requireMandate(mandateId: string): PayToMandate {
    const mandate = this.mandates.get(mandateId);
    if (!mandate) {
      throw new MandateNotFoundError(mandateId);
    }
    return mandate;
  }
}

const REQUIRED_BANKS: Bank[] = ['CBA', 'NAB', 'ANZ'];

export class MultiBankPayToService implements PayToService {
  private readonly providers = new Map<Bank, BankProvider>();
  private readonly mandateProviders = new Map<string, BankProvider>();

  constructor(bankProviders: BankProvider[]) {
    for (const provider of bankProviders) {
      this.providers.set(provider.bank, provider);
    }
    const missing = REQUIRED_BANKS.filter((bank) => !this.providers.has(bank));
    if (missing.length) {
      throw new Error(`Missing PayTo providers for: ${missing.join(', ')}`);
    }
  }

  async createMandate(account: DesignatedAccount): Promise<PayToMandate> {
    const provider = this.requireProvider(account.bank);
    const mandate = provider.createMandate(account);
    this.mandateProviders.set(mandate.id, provider);
    return mandate;
  }

  async authorizeMandate(mandateId: string): Promise<PayToMandate> {
    const provider = this.requireMandateProvider(mandateId);
    return provider.authorizeMandate(mandateId);
  }

  async verifyMandate(mandateId: string): Promise<boolean> {
    const provider = this.requireMandateProvider(mandateId);
    return provider.verifyMandate(mandateId);
  }

  requiresDepositOnly(bank: Bank): boolean {
    return this.requireProvider(bank).enforceDepositOnly;
  }

  async transfer(
    account: DesignatedAccount,
    amount: number,
    direction: TransferDirection,
  ): Promise<TransferReceipt> {
    const provider = this.requireProvider(account.bank);
    return provider.transfer(account, amount, direction);
  }

  private requireProvider(bank: Bank): BankProvider {
    const provider = this.providers.get(bank);
    if (!provider) {
      throw new Error(`No provider configured for ${bank}`);
    }
    return provider;
  }

  private requireMandateProvider(mandateId: string): BankProvider {
    const provider = this.mandateProviders.get(mandateId);
    if (!provider) {
      throw new MandateNotFoundError(mandateId);
    }
    return provider;
  }
}

export function createDefaultBankProviders(): BankProvider[] {
  return [
    new MockBankProvider('CBA', false),
    new MockBankProvider('NAB', true),
    new MockBankProvider('ANZ', true),
  ];
}
