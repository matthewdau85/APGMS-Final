import { randomUUID } from 'node:crypto';
import type {
  CreateDesignatedAccountInput,
  DesignatedAccount,
  TransferDirection,
  TransferReceipt,
} from './types.ts';
import type { PayToService } from './payto.ts';

export interface DesignatedAccountRepository {
  save(account: DesignatedAccount): Promise<DesignatedAccount>;
  get(accountId: string): Promise<DesignatedAccount | undefined>;
  list(): Promise<DesignatedAccount[]>;
}

export class InMemoryDesignatedAccountRepository
  implements DesignatedAccountRepository
{
  private readonly accounts = new Map<string, DesignatedAccount>();

  async save(account: DesignatedAccount): Promise<DesignatedAccount> {
    this.accounts.set(account.id, { ...account });
    return account;
  }

  async get(accountId: string): Promise<DesignatedAccount | undefined> {
    const account = this.accounts.get(accountId);
    return account ? { ...account } : undefined;
  }

  async list(): Promise<DesignatedAccount[]> {
    return Array.from(this.accounts.values()).map((account) => ({
      ...account,
    }));
  }
}

export class DesignatedAccountOrchestrator {
  constructor(
    private readonly repository: DesignatedAccountRepository,
    private readonly payToService: PayToService,
  ) {}

  async createAccount(
    input: CreateDesignatedAccountInput,
  ): Promise<DesignatedAccount> {
    const account: DesignatedAccount = {
      id: randomUUID(),
      orgId: input.orgId,
      bank: input.bank,
      bsb: input.bsb,
      accountNumber: input.accountNumber,
      obligation: input.obligation,
      depositOnly:
        input.depositOnly ?? this.payToService.requiresDepositOnly(input.bank),
      metadata: input.metadata,
    };

    await this.repository.save(account);
    const mandate = await this.payToService.createMandate(account);
    account.payToMandateId = mandate.id;
    account.payToStatus = mandate.status;
    await this.repository.save(account);
    return { ...account };
  }

  async activateMandate(accountId: string): Promise<DesignatedAccount> {
    const account = await this.requireAccount(accountId);
    if (!account.payToMandateId) {
      throw new Error(`Account ${accountId} does not have a PayTo mandate.`);
    }
    await this.payToService.authorizeMandate(account.payToMandateId);
    const verified = await this.payToService.verifyMandate(account.payToMandateId);
    if (!verified) {
      throw new Error(`Mandate ${account.payToMandateId} could not be verified.`);
    }
    account.payToStatus = 'ACTIVE';
    await this.repository.save(account);
    return account;
  }

  async initiateTransfer(
    accountId: string,
    amount: number,
    direction: TransferDirection,
  ): Promise<TransferReceipt> {
    const account = await this.requireAccount(accountId);
    if (account.payToStatus !== 'ACTIVE') {
      throw new Error(
        `Transfers are blocked until the PayTo mandate is active for ${accountId}.`,
      );
    }
    return this.payToService.transfer(account, amount, direction);
  }

  async getAccount(accountId: string): Promise<DesignatedAccount> {
    return this.requireAccount(accountId);
  }

  private async requireAccount(accountId: string): Promise<DesignatedAccount> {
    const account = await this.repository.get(accountId);
    if (!account) {
      throw new Error(`Designated account ${accountId} was not found.`);
    }
    return account;
  }
}
