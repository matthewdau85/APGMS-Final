import type { PrismaClient, DesignatedAccount } from "@prisma/client";
import { conflict } from "../errors.js";
import { applyDesignatedAccountTransfer } from "@apgms/domain-policy";

export type DesignatedAccountType = "PAYGW_BUFFER" | "GST_BUFFER";

const ALLOWED_TYPES: DesignatedAccountType[] = ["PAYGW_BUFFER", "GST_BUFFER"];

function assertTaxType(type: string): asserts type is DesignatedAccountType {
  if (!ALLOWED_TYPES.includes(type as DesignatedAccountType)) {
    throw new Error(`Unsupported designated account type: ${type}`);
  }
}

export interface BankingAdapter {
  getBalance(account: DesignatedAccount): Promise<number>;
  blockTransfer?(account: DesignatedAccount, shortfall: number): Promise<void>;
}

class PrismaBankingAdapter implements BankingAdapter {
  async getBalance(account: DesignatedAccount): Promise<number> {
    return Number(account.balance);
  }

  async blockTransfer(account: DesignatedAccount, shortfall: number): Promise<void> {
    await account; // no-op for now; placeholder for future alerts/sandbox plan
  }
}

class PartnerBankingAdapter implements BankingAdapter {
  constructor(private url: string, private token?: string) {}

  private headers(): Record<string, string> {
    const auth = this.token ? { Authorization: `Bearer ${this.token}` } : {};
    return {
      "Content-Type": "application/json",
      ...auth,
    };
  }

  private accountEndpoint(account: DesignatedAccount) {
    return `${this.url.replace(/\/$/, "")}/accounts/${account.id}`;
  }

  async getBalance(account: DesignatedAccount): Promise<number> {
    const res = await fetch(`${this.accountEndpoint(account)}/balance`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`Partner adapter balance fetch failed: ${res.status}`);
    }
    const payload = await res.json();
    return Number(payload.balance ?? 0);
  }

  async blockTransfer(account: DesignatedAccount, shortfall: number): Promise<void> {
    await fetch(`${this.accountEndpoint(account)}/lock`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ shortfall }),
    });
  }
}

let currentAdapter: BankingAdapter;

const partnerUrl = process.env.DESIGNATED_BANKING_URL?.trim();
const partnerToken = process.env.DESIGNATED_BANKING_TOKEN?.trim();
if (partnerUrl && partnerUrl.length > 0) {
  currentAdapter = new PartnerBankingAdapter(partnerUrl, partnerToken);
} else {
  currentAdapter = new PrismaBankingAdapter();
}

/** Configure the adapter that simulates the banking partner. Swap this for a sandbox/ADI connector later. */
export function configureBankingAdapter(adapter: BankingAdapter): void {
  currentAdapter = adapter;
}

export async function getDesignatedAccountByType(
  prisma: PrismaClient,
  orgId: string,
  type: string,
): Promise<DesignatedAccount> {
  assertTaxType(type);
  const account = await prisma.designatedAccount.findFirst({
    where: { orgId, type },
  });
  if (!account) {
    throw conflict(
      "designated_account_not_found",
      `Designated account for ${type} is not configured for org ${orgId}`,
    );
  }
  return account;
}

export interface CoverageContext {
  cycleId?: string;
  description?: string;
}

export async function ensureDesignatedAccountCoverage(
  prisma: PrismaClient,
  orgId: string,
  type: DesignatedAccountType,
  requiredAmount: number,
  context?: CoverageContext,
): Promise<DesignatedAccount> {
  const account = await getDesignatedAccountByType(prisma, orgId, type);
  const balance = await currentAdapter.getBalance(account);
  const shortfall = requiredAmount - balance;
  if (shortfall > 0) {
    await prisma.alert.create({
      data: {
        orgId,
        type: "DESIGNATED_FUNDS_SHORTFALL",
        severity: "HIGH",
        message: `Designated ${type} account is short by ${shortfall.toFixed(2)}`,
        metadata: {
          requiredAmount,
          balance,
          cycleId: context?.cycleId ?? null,
          description: context?.description ?? null,
        },
      },
    });
    await currentAdapter.blockTransfer?.(account, shortfall);
    await markAccountLocked(prisma, account.id);
    throw conflict(
      "designated_insufficient_funds",
      `Designated ${type} account balance ${balance.toFixed(2)} does not cover requirement ${requiredAmount.toFixed(2)}`,
    );
  }
  return account;
}

export async function releaseAccountLock(
  prisma: PrismaClient,
  accountId: string,
): Promise<void> {
  await prisma.designatedAccount.update({
    where: { id: accountId },
    data: {
      locked: false,
      lockedAt: null,
    },
  });
}

export async function markAccountLocked(
  prisma: PrismaClient,
  accountId: string,
): Promise<void> {
  await prisma.designatedAccount.update({
    where: { id: accountId },
    data: {
      locked: true,
      lockedAt: new Date(),
    },
  });
}

export async function reconcileAccountSnapshot(
  prisma: PrismaClient,
  orgId: string,
  type: DesignatedAccountType,
  ): Promise<{
    account: DesignatedAccount;
    balance: number;
    updatedAt: Date;
    locked: boolean;
  }> {
  const account = await getDesignatedAccountByType(prisma, orgId, type);
  return {
    account,
    balance: Number(account.balance),
    updatedAt: account.updatedAt,
    locked: account.locked,
  };
}
